package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/labstack/echo/v4"
	echoMiddleware "github.com/labstack/echo/v4/middleware"
	"github.com/maestrohub/license-server/internal/api"
	"github.com/maestrohub/license-server/internal/config"
	"github.com/maestrohub/license-server/internal/crypto"
	"github.com/maestrohub/license-server/internal/email"
	"github.com/maestrohub/license-server/internal/middleware"
	"github.com/maestrohub/license-server/internal/repository"
	"github.com/maestrohub/license-server/internal/service"
	"github.com/maestrohub/license-server/internal/utils"
	"github.com/rs/zerolog/log"
)

const Version = "1.0.0"

func main() {
	var configPath string
	flag.StringVar(&configPath, "config", "", "Path to config file")
	flag.Parse()

	cfg, err := config.Load(configPath)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load config")
	}

	utils.InitLogger(cfg.Logging.Level, cfg.Logging.Format)

	log.Info().
		Str("version", Version).
		Str("environment", cfg.Server.Environment).
		Msg("Starting License Server")

	db, err := repository.NewDatabase(&cfg.Database)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to database")
	}
	defer db.Close()

	if err := db.Migrate(); err != nil {
		log.Fatal().Err(err).Msg("Failed to migrate database")
	}

	signer := crypto.NewEd25519Signer()

	existingKey, err := loadOrCreateKey(db, signer)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize signing key")
	}
	log.Info().Str("kid", existingKey.KID).Msg("Using signing key")

	licenseRepo := repository.NewLicenseRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	extensionRepo := repository.NewExtensionRequestRepository(db)

	licenseService := service.NewLicenseService(db, licenseRepo, customerRepo, extensionRepo, signer)
	emailService := email.NewEmailService(&cfg.Email, db)

	e := echo.New()
	e.HideBanner = true
	e.HidePort = true

	e.Use(utils.LoggerMiddleware())
	e.Use(echoMiddleware.Recover())
	e.Use(echoMiddleware.RequestID())
	e.Use(middleware.CORSMiddleware(&cfg.Security))

	e.HTTPErrorHandler = customHTTPErrorHandler

	setupRoutes(e, &routeDeps{
		db:             db,
		cfg:            cfg,
		licenseService: licenseService,
		emailService:   emailService,
		customerRepo:   customerRepo,
		signer:         signer,
	})

	server := &http.Server{
		Addr:         fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port),
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	go func() {
		log.Info().
			Str("host", cfg.Server.Host).
			Str("port", cfg.Server.Port).
			Msg("Server started")

		if err := e.StartServer(server); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Server failed")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), cfg.Server.ShutdownTimeout)
	defer cancel()

	if err := e.Shutdown(ctx); err != nil {
		log.Fatal().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server shutdown complete")
}

type routeDeps struct {
	db             *repository.Database
	cfg            *config.Config
	licenseService service.LicenseService
	emailService   email.EmailService
	customerRepo   repository.CustomerRepository
	signer         crypto.Signer
}

func setupRoutes(e *echo.Echo, deps *routeDeps) {
	// Core handlers
	licenseRequestHandler := api.NewLicenseRequestHandler(deps.licenseService, deps.emailService)
	extensionHandler := api.NewExtensionHandler(deps.licenseService)
	licenseHandler := api.NewLicenseHandler(deps.licenseService)
	healthHandler := api.NewHealthHandler(deps.db, Version)
	authHandler := api.NewAuthHandler(deps.db, &deps.cfg.JWT)

	e.GET("/healthz", healthHandler.Health)
	e.GET("/readyz", healthHandler.Ready)
	e.GET("/metrics", healthHandler.Metrics)

	v1 := e.Group("/api/v1")

	// Authentication endpoints (public)
	v1.POST("/auth/login", authHandler.Login)

	// Public endpoints (API key required for applications)
	appAuth := middleware.APIKeyAuth(deps.db)
	rateLimitApp := middleware.RateLimitByAPIKey(deps.db)

	// 1. Application requests license for user (PROTECTED)
	v1.POST("/license/request", licenseRequestHandler.RequestLicense, appAuth, rateLimitApp)

	// 2. Verify license signature (for applications) - less strict
	v1.POST("/license/verify", licenseHandler.VerifyLicense)

	// 3. Get public key for signature verification (truly public)
	e.GET("/.well-known/licensing-public-key", licenseHandler.GetPublicKey)

	// 4. Get revoked licenses list (truly public for offline checks)
	e.GET("/api/v1/revocations", licenseHandler.GetRevocations)

	// Admin endpoints (JWT auth required)
	adminAuth := middleware.JWTMiddleware(&deps.cfg.JWT)
	adminGroup := v1.Group("/admin")
	adminGroup.Use(adminAuth)
	adminGroup.Use(middleware.RequireAdmin())

	// Admin user management
	adminGroup.POST("/users", authHandler.CreateAdmin)

	// API key management
	adminGroup.POST("/api-keys", authHandler.CreateAPIKey)
	adminGroup.GET("/api-keys", authHandler.ListAPIKeys)
	adminGroup.DELETE("/api-keys/:id", authHandler.RevokeAPIKey)

	// View extension requests
	adminGroup.GET("/extension-requests", extensionHandler.GetExtensionRequests)
	adminGroup.GET("/extension-requests/:id", extensionHandler.GetExtensionRequest)
	adminGroup.POST("/extension-requests/:id/approve", extensionHandler.ApproveExtensionRequest)
	adminGroup.POST("/extension-requests/:id/reject", extensionHandler.RejectExtensionRequest)

	// License management (for special cases)
	adminGroup.POST("/licenses/extend/:id", licenseHandler.ExtendLicense)
	adminGroup.POST("/licenses/revoke/:id", licenseHandler.RevokeLicense)
	adminGroup.GET("/licenses", licenseHandler.ListLicenses)
	adminGroup.GET("/licenses/:id", licenseHandler.GetLicense)

	// Extension request from user (no portal needed - simpler)
	v1.POST("/license/request-extension", extensionHandler.RequestExtension)
}

func loadOrCreateKey(db *repository.Database, signer *crypto.Ed25519Signer) (*crypto.KeyPair, error) {
	var keys []struct {
		KID           string `db:"kid"`
		PublicKey     string `db:"public_key"`
		PrivateKeyEnc string `db:"private_key_enc"`
		Active        bool   `db:"active"`
	}

	query := `SELECT kid, public_key, private_key_enc, active FROM keys WHERE active = true LIMIT 1`
	err := db.Select(&keys, query)
	if err == nil && len(keys) > 0 {
		kp, err := crypto.ParseKeyPair(keys[0].PublicKey, keys[0].PrivateKeyEnc, keys[0].KID)
		if err != nil {
			return nil, fmt.Errorf("failed to parse existing key: %w", err)
		}
		signer.AddKeyPair(kp)
		signer.SetActiveKey(kp.KID)
		return kp, nil
	}

	kp, err := signer.GenerateKeyPair()
	if err != nil {
		return nil, fmt.Errorf("failed to generate key pair: %w", err)
	}

	publicPEM, err := signer.ExportPublicKey(kp.KID)
	if err != nil {
		return nil, fmt.Errorf("failed to export public key: %w", err)
	}

	privatePEM, err := signer.ExportPrivateKey(kp.KID)
	if err != nil {
		return nil, fmt.Errorf("failed to export private key: %w", err)
	}

	insertQuery := `
		INSERT INTO keys (kid, alg, public_key, private_key_enc, created_at, active)
		VALUES (?, ?, ?, ?, ?, ?)`

	_, err = db.Exec(insertQuery, kp.KID, kp.Algorithm, publicPEM, privatePEM, time.Now(), true)
	if err != nil {
		return nil, fmt.Errorf("failed to store key: %w", err)
	}

	return kp, nil
}

func customHTTPErrorHandler(err error, c echo.Context) {
	code := http.StatusInternalServerError
	message := "Internal Server Error"

	if he, ok := err.(*echo.HTTPError); ok {
		code = he.Code
		message = fmt.Sprintf("%v", he.Message)
	}

	if !c.Response().Committed {
		if c.Request().Method == http.MethodHead {
			c.NoContent(code)
		} else {
			c.JSON(code, map[string]interface{}{
				"error": message,
				"code":  code,
			})
		}
	}

	if code >= 500 {
		log.Error().
			Err(err).
			Str("path", c.Path()).
			Str("method", c.Request().Method).
			Int("status", code).
			Msg("Server error")
	}
}
