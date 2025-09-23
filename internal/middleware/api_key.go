package middleware

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/maestrohub/license-server/internal/repository"
)

// APIKeyAuth middleware for application authentication
func APIKeyAuth(db *repository.Database) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Check header first
			apiKey := c.Request().Header.Get("X-API-Key")
			if apiKey == "" {
				// Check query parameter as fallback
				apiKey = c.QueryParam("api_key")
			}

			if apiKey == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "API key required")
			}

			// Validate API key format
			if !strings.HasPrefix(apiKey, "mhub_") || len(apiKey) < 32 {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid API key format")
			}

			// Check API key in database
			valid, appID, err := validateAPIKey(db, apiKey)
			if err != nil || !valid {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid API key")
			}

			// Store app info in context
			c.Set("app_id", appID)
			c.Set("api_key", apiKey)

			return next(c)
		}
	}
}

func validateAPIKey(db *repository.Database, apiKey string) (bool, string, error) {
	var result struct {
		AppID     string `db:"app_id"`
		KeyHash   string `db:"key_hash"`
		Active    bool   `db:"active"`
		RateLimit int    `db:"rate_limit"`
	}

	query := `
		SELECT app_id, key_hash, active, rate_limit
		FROM api_keys
		WHERE key_prefix = ? AND active = true
	`

	// Extract prefix (first 12 chars after mhub_)
	prefix := apiKey[5:17]
	err := db.Get(&result, query, prefix)
	if err != nil {
		return false, "", err
	}

	// Constant-time comparison of full key hash
	// In production, apiKey should be hashed and compared
	if subtle.ConstantTimeCompare([]byte(apiKey), []byte(result.KeyHash)) == 1 {
		return true, result.AppID, nil
	}

	return false, "", nil
}

// RateLimitByAPIKey applies rate limiting per API key
func RateLimitByAPIKey(db *repository.Database) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			appID := c.Get("app_id")
			if appID == nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "API key required")
			}

			// Check rate limit for this API key
			limited, err := checkRateLimit(db, appID.(string))
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "Rate limit check failed")
			}

			if limited {
				return echo.NewHTTPError(http.StatusTooManyRequests, "Rate limit exceeded")
			}

			return next(c)
		}
	}
}

func checkRateLimit(db *repository.Database, appID string) (bool, error) {
	// Implementation would check Redis or in-memory cache
	// For now, simplified version
	query := `
		INSERT INTO api_requests (app_id, requested_at)
		VALUES (?, datetime('now'))
	`
	_, err := db.Exec(query, appID)
	if err != nil {
		return false, err
	}

	// Check if exceeded limit in last minute
	var count int
	countQuery := `
		SELECT COUNT(*)
		FROM api_requests
		WHERE app_id = ?
		AND requested_at > datetime('now', '-1 minute')
	`
	err = db.Get(&count, countQuery, appID)
	if err != nil {
		return false, err
	}

	// Get rate limit for this app
	var rateLimit int
	limitQuery := `SELECT rate_limit FROM api_keys WHERE app_id = ?`
	err = db.Get(&rateLimit, limitQuery, appID)
	if err != nil {
		rateLimit = 60 // Default
	}

	return count > rateLimit, nil
}