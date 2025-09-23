package api

import (
	"net/http"
	"strconv"

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
	// TODO: Implement actual query to get revoked licenses
	// query := `
	// 	SELECT r.license_id, r.created_at
	// 	FROM revocations r
	// 	ORDER BY r.created_at DESC
	// 	LIMIT 1000`

	return c.JSON(http.StatusOK, map[string]interface{}{
		"updated_at": "2025-09-23T10:00:00Z",
		"items":      []string{},
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

	if page <= 0 {
		page = 1
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	// offset := (page - 1) * limit
	// TODO: Use offset to implement actual pagination

	return c.JSON(http.StatusOK, map[string]interface{}{
		"licenses": []models.License{},
		"page":     page,
		"limit":    limit,
		"total":    0,
	})
}