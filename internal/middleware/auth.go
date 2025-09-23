package middleware

import (
	"crypto/subtle"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"github.com/maestrohub/license-server/internal/config"
)

type AuthClaims struct {
	jwt.RegisteredClaims
	UserID     string `json:"user_id"`
	Email      string `json:"email"`
	CustomerID string `json:"customer_id,omitempty"`
	Role       string `json:"role"`
}


func JWTMiddleware(jwtConfig *config.JWTConfig) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				cookie, err := c.Cookie("auth_token")
				if err != nil {
					return echo.NewHTTPError(http.StatusUnauthorized, "missing token")
				}
				authHeader = "Bearer " + cookie.Value
			}

			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid token format")
			}

			tokenString := parts[1]

			token, err := jwt.ParseWithClaims(tokenString, &AuthClaims{}, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
				}
				return []byte(jwtConfig.Secret), nil
			})

			if err != nil {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
			}

			if claims, ok := token.Claims.(*AuthClaims); ok && token.Valid {
				c.Set("user", claims)
				return next(c)
			}

			return echo.NewHTTPError(http.StatusUnauthorized, "invalid token")
		}
	}
}

func RequireAdmin() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user, ok := c.Get("user").(*AuthClaims)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
			}

			if user.Role != "admin" {
				return echo.NewHTTPError(http.StatusForbidden, "admin access required")
			}

			return next(c)
		}
	}
}

func RequireCustomer() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			user, ok := c.Get("user").(*AuthClaims)
			if !ok {
				return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
			}

			if user.Role != "customer" {
				return echo.NewHTTPError(http.StatusForbidden, "customer access required")
			}

			return next(c)
		}
	}
}

func CSRFMiddleware(securityConfig *config.SecurityConfig) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if c.Request().Method == "GET" || c.Request().Method == "HEAD" || c.Request().Method == "OPTIONS" {
				return next(c)
			}

			csrfToken := c.Request().Header.Get("X-CSRF-Token")
			if csrfToken == "" {
				csrfToken = c.FormValue("csrf_token")
			}

			sessionToken := c.Get("csrf_token")
			if sessionToken == nil || sessionToken == "" {
				return echo.NewHTTPError(http.StatusForbidden, "CSRF token not found in session")
			}

			if subtle.ConstantTimeCompare([]byte(csrfToken), []byte(sessionToken.(string))) != 1 {
				return echo.NewHTTPError(http.StatusForbidden, "invalid CSRF token")
			}

			return next(c)
		}
	}
}

func CORSMiddleware(securityConfig *config.SecurityConfig) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			origin := c.Request().Header.Get("Origin")

			allowed := false
			for _, allowedOrigin := range securityConfig.AllowedOrigins {
				if allowedOrigin == "*" || origin == allowedOrigin {
					allowed = true
					break
				}
			}

			if allowed {
				c.Response().Header().Set("Access-Control-Allow-Origin", origin)
				c.Response().Header().Set("Access-Control-Allow-Credentials", "true")
				c.Response().Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				c.Response().Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-CSRF-Token")
				c.Response().Header().Set("Access-Control-Max-Age", "3600")
			}

			if c.Request().Method == "OPTIONS" {
				return c.NoContent(http.StatusOK)
			}

			return next(c)
		}
	}
}

func RateLimitMiddleware(limit int, window time.Duration) echo.MiddlewareFunc {
	type visitor struct {
		lastSeen  time.Time
		count     int
	}

	visitors := make(map[string]*visitor)

	cleanup := func() {
		now := time.Now()
		for ip, v := range visitors {
			if now.Sub(v.lastSeen) > window {
				delete(visitors, ip)
			}
		}
	}

	go func() {
		ticker := time.NewTicker(window)
		for range ticker.C {
			cleanup()
		}
	}()

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			ip := c.RealIP()
			now := time.Now()

			v, exists := visitors[ip]
			if !exists {
				visitors[ip] = &visitor{lastSeen: now, count: 1}
				return next(c)
			}

			if now.Sub(v.lastSeen) > window {
				v.count = 1
				v.lastSeen = now
				return next(c)
			}

			v.count++
			if v.count > limit {
				return echo.NewHTTPError(http.StatusTooManyRequests, "rate limit exceeded")
			}

			v.lastSeen = now
			return next(c)
		}
	}
}

func GenerateToken(claims *AuthClaims, secret string, expiry time.Duration) (string, error) {
	claims.ExpiresAt = jwt.NewNumericDate(time.Now().Add(expiry))
	claims.IssuedAt = jwt.NewNumericDate(time.Now())
	claims.NotBefore = jwt.NewNumericDate(time.Now())

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}