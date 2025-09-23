package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/maestrohub/license-server/internal/middleware"
	"github.com/maestrohub/license-server/internal/service"
	"github.com/maestrohub/license-server/pkg/models"
)

type LicenseHandler struct {
	licenseService service.LicenseService
	validator      *validator.Validate
}

func NewLicenseHandler(licenseService service.LicenseService) *LicenseHandler {
	return &LicenseHandler{
		licenseService: licenseService,
		validator:      validator.New(),
	}
}

func (h *LicenseHandler) CreateLicense(c echo.Context) error {
	var req service.CreateLicenseRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if err := h.validator.Struct(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	license, err := h.licenseService.CreateLicense(&req)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"license_id":  license.LicenseID,
		"valid_until": license.ValidUntil,
	})
}

func (h *LicenseHandler) GetLicense(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "license id required")
	}

	license, err := h.licenseService.GetLicense(id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "license not found")
	}

	return c.JSON(http.StatusOK, license)
}

func (h *LicenseHandler) ExtendLicense(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "license id required")
	}

	var req struct {
		Months int `json:"months" validate:"required,min=1,max=12"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if err := h.validator.Struct(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	license, err := h.licenseService.ExtendLicense(id, req.Months)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"license_id":  license.LicenseID,
		"valid_until": license.ValidUntil,
	})
}

func (h *LicenseHandler) RevokeLicense(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "license id required")
	}

	var req struct {
		Reason string `json:"reason" validate:"required"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if err := h.validator.Struct(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	user := c.Get("user").(*middleware.AuthClaims)
	actor := user.Email

	if err := h.licenseService.RevokeLicense(id, req.Reason, actor); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "license revoked successfully",
	})
}

func (h *LicenseHandler) GetCustomerLicenses(c echo.Context) error {
	customerID := c.Param("customerID")
	if customerID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "customer id required")
	}

	licenses, err := h.licenseService.GetCustomerLicenses(customerID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, licenses)
}

func (h *LicenseHandler) GetPublicKey(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"kid":        "current-key-id",
		"alg":        "ed25519",
		"public_key": "base64-encoded-public-key",
	})
}

func (h *LicenseHandler) GetRevocations(c echo.Context) error {
	// Get all revoked license IDs
	revokedLicenses, err := h.licenseService.GetRevokedLicenses()
	if err != nil {
		// Return empty list on error (fail open for offline verification)
		return c.JSON(http.StatusOK, map[string]interface{}{
			"revoked":     []string{},
			"updated_at":  time.Now().UTC().Format(time.RFC3339),
			"next_update": time.Now().Add(1 * time.Hour).UTC().Format(time.RFC3339),
		})
	}

	// Extract just the license IDs
	licenseIDs := make([]string, 0, len(revokedLicenses))
	for _, license := range revokedLicenses {
		licenseIDs = append(licenseIDs, license.LicenseID)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"revoked":     licenseIDs,
		"updated_at":  time.Now().UTC().Format(time.RFC3339),
		"next_update": time.Now().Add(1 * time.Hour).UTC().Format(time.RFC3339),
	})
}

func (h *LicenseHandler) VerifyLicense(c echo.Context) error {
	var license models.License
	if err := c.Bind(&license); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid license format")
	}

	if err := h.licenseService.VerifyLicense(&license); err != nil {
		return c.JSON(http.StatusOK, map[string]interface{}{
			"valid":  false,
			"reason": err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"valid": true,
	})
}

func (h *LicenseHandler) ListLicenses(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	status := c.QueryParam("status")
	product := c.QueryParam("product")
	search := c.QueryParam("search")

	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	offset := (page - 1) * limit

	// Build filter criteria
	filters := &service.LicenseFilters{
		Status:  status,
		Product: product,
		Search:  search,
		Offset:  offset,
		Limit:   limit,
	}

	// Get licenses with filters
	licenses, total, err := h.licenseService.ListLicenses(filters)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch licenses")
	}

	// Convert to response format
	licenseDTOs := make([]map[string]interface{}, 0, len(licenses))
	for _, license := range licenses {
		dto := map[string]interface{}{
			"license_id":  license.LicenseID,
			"customer_id": license.CustomerID,
			"product":     license.Product,
			"valid_from":  license.ValidFrom,
			"valid_until": license.ValidUntil,
			"lifetime":    license.Lifetime,
			"features":    license.Features,
			"created_at":  license.ValidFrom,
		}

		// Add status based on validity
		if license.Lifetime {
			dto["status"] = "active"
		} else if license.ValidUntil != nil && license.ValidUntil.After(time.Now()) {
			dto["status"] = "active"
			dto["days_until_expiry"] = int(time.Until(*license.ValidUntil).Hours() / 24)
		} else {
			dto["status"] = "expired"
		}

		licenseDTOs = append(licenseDTOs, dto)
	}

	totalPages := (total + limit - 1) / limit

	return c.JSON(http.StatusOK, map[string]interface{}{
		"licenses": licenseDTOs,
		"pagination": map[string]interface{}{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": totalPages,
			"has_next":    page < totalPages,
			"has_prev":    page > 1,
		},
	})
}