package api

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/maestrohub/license-server/internal/config"
	"github.com/maestrohub/license-server/internal/middleware"
	"github.com/maestrohub/license-server/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	db        *repository.Database
	jwtConfig *config.JWTConfig
	validator *validator.Validate
}

func NewAuthHandler(db *repository.Database, jwtConfig *config.JWTConfig) *AuthHandler {
	return &AuthHandler{
		db:        db,
		jwtConfig: jwtConfig,
		validator: validator.New(),
	}
}

// Admin Login
type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

type LoginResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	User      UserInfo  `json:"user"`
}

type UserInfo struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	if err := h.validator.Struct(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Get user from database
	var user struct {
		ID           string `db:"id"`
		Email        string `db:"email"`
		Name         string `db:"name"`
		PasswordHash string `db:"password_hash"`
		Role         string `db:"role"`
		Active       bool   `db:"active"`
	}

	query := `SELECT id, email, name, password_hash, role, active FROM admin_users WHERE email = ? AND active = true`
	err := h.db.Get(&user, query, req.Email)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid credentials")
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid credentials")
	}

	// Generate JWT token
	claims := &middleware.AuthClaims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
	}

	token, err := middleware.GenerateToken(claims, h.jwtConfig.Secret, h.jwtConfig.AdminExpiry)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to generate token")
	}

	// Update last login
	updateQuery := `UPDATE admin_users SET last_login = datetime('now') WHERE id = ?`
	h.db.Exec(updateQuery, user.ID)

	return c.JSON(http.StatusOK, LoginResponse{
		Token:     token,
		ExpiresAt: time.Now().Add(h.jwtConfig.AdminExpiry),
		User: UserInfo{
			ID:    user.ID,
			Email: user.Email,
			Name:  user.Name,
			Role:  user.Role,
		},
	})
}

// Create Admin User (requires existing admin)
type CreateAdminRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Name     string `json:"name" validate:"required"`
	Password string `json:"password" validate:"required,min=8"`
	Role     string `json:"role" validate:"required,oneof=admin viewer"`
}

func (h *AuthHandler) CreateAdmin(c echo.Context) error {
	var req CreateAdminRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	if err := h.validator.Struct(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to hash password")
	}

	// Generate ID
	id := generateID("admin")

	// Insert admin user
	query := `
		INSERT INTO admin_users (id, email, name, password_hash, role, active, created_at)
		VALUES (?, ?, ?, ?, ?, true, datetime('now'))
	`

	_, err = h.db.Exec(query, id, req.Email, req.Name, string(hashedPassword), req.Role)
	if err != nil {
		return echo.NewHTTPError(http.StatusConflict, "email already exists")
	}

	return c.JSON(http.StatusCreated, map[string]string{
		"id":      id,
		"message": "admin user created successfully",
	})
}

// API Key Management
type CreateAPIKeyRequest struct {
	AppName   string `json:"app_name" validate:"required"`
	RateLimit int    `json:"rate_limit" validate:"min=1,max=10000"`
	Notes     string `json:"notes"`
}

type APIKeyResponse struct {
	APIKey    string    `json:"api_key"`
	AppID     string    `json:"app_id"`
	AppName   string    `json:"app_name"`
	RateLimit int       `json:"rate_limit"`
	CreatedAt time.Time `json:"created_at"`
}

func (h *AuthHandler) CreateAPIKey(c echo.Context) error {
	var req CreateAPIKeyRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request")
	}

	if err := h.validator.Struct(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Get current admin from context
	user := c.Get("user").(*middleware.AuthClaims)

	// Generate API key
	apiKey := generateAPIKey()
	appID := generateID("app")
	prefix := apiKey[5:17] // Extract prefix for indexing

	if req.RateLimit == 0 {
		req.RateLimit = 60 // Default rate limit
	}

	// Store API key
	query := `
		INSERT INTO api_keys (app_id, app_name, key_prefix, key_hash, rate_limit, created_by, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
	`

	_, err := h.db.Exec(query, appID, req.AppName, prefix, apiKey, req.RateLimit, user.Email, req.Notes)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create API key")
	}

	return c.JSON(http.StatusCreated, APIKeyResponse{
		APIKey:    apiKey,
		AppID:     appID,
		AppName:   req.AppName,
		RateLimit: req.RateLimit,
		CreatedAt: time.Now(),
	})
}

func (h *AuthHandler) ListAPIKeys(c echo.Context) error {
	var keys []struct {
		AppID      string    `db:"app_id" json:"app_id"`
		AppName    string    `db:"app_name" json:"app_name"`
		KeyPrefix  string    `db:"key_prefix" json:"key_prefix"`
		RateLimit  int       `db:"rate_limit" json:"rate_limit"`
		Active     bool      `db:"active" json:"active"`
		CreatedAt  time.Time `db:"created_at" json:"created_at"`
		LastUsed   *time.Time `db:"last_used" json:"last_used,omitempty"`
		CreatedBy  string    `db:"created_by" json:"created_by"`
	}

	query := `
		SELECT app_id, app_name, key_prefix, rate_limit, active, created_at, last_used, created_by
		FROM api_keys
		ORDER BY created_at DESC
	`

	err := h.db.Select(&keys, query)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to list API keys")
	}

	// Mask the keys - only show prefix
	for i := range keys {
		keys[i].KeyPrefix = "mhub_" + keys[i].KeyPrefix[:8] + "..."
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"keys":  keys,
		"total": len(keys),
	})
}

func (h *AuthHandler) RevokeAPIKey(c echo.Context) error {
	appID := c.Param("id")
	if appID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "app ID required")
	}

	query := `UPDATE api_keys SET active = false WHERE app_id = ?`
	result, err := h.db.Exec(query, appID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to revoke API key")
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "API key not found")
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "API key revoked successfully",
	})
}

// Helper functions
func generateID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return prefix + "_" + hex.EncodeToString(b)
}

func generateAPIKey() string {
	b := make([]byte, 32)
	rand.Read(b)
	return "mhub_sk_live_" + hex.EncodeToString(b)[:40]
}

// Initialize first admin (CLI command)
func (h *AuthHandler) InitializeAdmin(email, password, name string) error {
	// Check if any admin exists
	var count int
	countQuery := `SELECT COUNT(*) FROM admin_users`
	h.db.Get(&count, countQuery)

	if count > 0 {
		return echo.NewHTTPError(http.StatusConflict, "admin already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	// Create first admin
	id := generateID("admin")
	query := `
		INSERT INTO admin_users (id, email, name, password_hash, role, active, created_at)
		VALUES (?, ?, ?, ?, 'admin', true, datetime('now'))
	`

	_, err = h.db.Exec(query, id, email, name, string(hashedPassword))
	return err
}