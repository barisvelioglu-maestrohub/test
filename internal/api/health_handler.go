package api

import (
	"net/http"
	"runtime"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/maestrohub/license-server/internal/repository"
)

type HealthHandler struct {
	db        *repository.Database
	startTime time.Time
	version   string
}

func NewHealthHandler(db *repository.Database, version string) *HealthHandler {
	return &HealthHandler{
		db:        db,
		startTime: time.Now(),
		version:   version,
	}
}

func (h *HealthHandler) Health(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"status":  "healthy",
		"version": h.version,
		"uptime":  time.Since(h.startTime).String(),
	})
}

func (h *HealthHandler) Ready(c echo.Context) error {
	if err := h.db.Ping(); err != nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]interface{}{
			"status": "not ready",
			"error":  "database connection failed",
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"status": "ready",
	})
}

func (h *HealthHandler) Metrics(c echo.Context) error {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	var dbStats struct {
		TotalLicenses   int `db:"total_licenses"`
		ActiveLicenses  int `db:"active_licenses"`
		TotalCustomers  int `db:"total_customers"`
		TotalRevocations int `db:"total_revocations"`
	}

	queries := []string{
		`SELECT COUNT(*) as total_licenses FROM licenses`,
		`SELECT COUNT(*) as active_licenses FROM licenses WHERE status = 'active'`,
		`SELECT COUNT(*) as total_customers FROM customers`,
		`SELECT COUNT(*) as total_revocations FROM revocations`,
	}

	h.db.Get(&dbStats.TotalLicenses, queries[0])
	h.db.Get(&dbStats.ActiveLicenses, queries[1])
	h.db.Get(&dbStats.TotalCustomers, queries[2])
	h.db.Get(&dbStats.TotalRevocations, queries[3])

	return c.JSON(http.StatusOK, map[string]interface{}{
		"system": map[string]interface{}{
			"uptime_seconds":  time.Since(h.startTime).Seconds(),
			"goroutines":      runtime.NumGoroutine(),
			"memory_alloc_mb": m.Alloc / 1024 / 1024,
			"memory_sys_mb":   m.Sys / 1024 / 1024,
			"gc_runs":         m.NumGC,
		},
		"business": map[string]interface{}{
			"total_licenses":    dbStats.TotalLicenses,
			"active_licenses":   dbStats.ActiveLicenses,
			"total_customers":   dbStats.TotalCustomers,
			"total_revocations": dbStats.TotalRevocations,
		},
	})
}