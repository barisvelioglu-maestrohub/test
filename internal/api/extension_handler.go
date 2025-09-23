package api

import (
	"net/http"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/maestrohub/license-server/internal/middleware"
	"github.com/maestrohub/license-server/internal/service"
	"github.com/maestrohub/license-server/pkg/models"
)

type ExtensionHandler struct {
	licenseService service.LicenseService
	validator      *validator.Validate
}

func NewExtensionHandler(licenseService service.LicenseService) *ExtensionHandler {
	return &ExtensionHandler{
		licenseService: licenseService,
		validator:      validator.New(),
	}
}

// Admin endpoints

func (h *ExtensionHandler) GetExtensionRequests(c echo.Context) error {
	statusParam := c.QueryParam("status")
	var status *models.ExtensionRequestStatus

	if statusParam != "" {
		s := models.ExtensionRequestStatus(statusParam)
		status = &s
	}

	requests, err := h.licenseService.GetExtensionRequests(status)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"requests": requests,
		"total":    len(requests),
	})
}

func (h *ExtensionHandler) GetExtensionRequest(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "request id required")
	}

	request, err := h.licenseService.GetExtensionRequest(id)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "request not found")
	}

	return c.JSON(http.StatusOK, request)
}

func (h *ExtensionHandler) ApproveExtensionRequest(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "request id required")
	}

	var req struct {
		ApprovedMonths int    `json:"approved_months" validate:"required,min=1,max=12"`
		Notes          string `json:"notes"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if err := h.validator.Struct(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	user := c.Get("user").(*middleware.AuthClaims)
	reviewedBy := user.Email

	if err := h.licenseService.ApproveExtensionRequest(id, req.ApprovedMonths, reviewedBy, req.Notes); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "extension request approved",
		"status":  "approved",
	})
}

func (h *ExtensionHandler) RejectExtensionRequest(c echo.Context) error {
	id := c.Param("id")
	if id == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "request id required")
	}

	var req struct {
		Notes string `json:"notes" validate:"required"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if err := h.validator.Struct(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	user := c.Get("user").(*middleware.AuthClaims)
	reviewedBy := user.Email

	if err := h.licenseService.RejectExtensionRequest(id, reviewedBy, req.Notes); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "extension request rejected",
		"status":  "rejected",
	})
}

// Customer endpoint - no auth required, validates via license ID and email
func (h *ExtensionHandler) RequestExtension(c echo.Context) error {
	var req struct {
		LicenseID       string `json:"license_id" validate:"required"`
		Email           string `json:"email" validate:"required,email"`
		RequestedMonths int    `json:"requested_months" validate:"required,min=1,max=12"`
		Reason          string `json:"reason" validate:"required"`
	}

	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if err := h.validator.Struct(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Verify the license belongs to this email
	license, err := h.licenseService.GetLicense(req.LicenseID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "license not found")
	}

	customer, err := h.licenseService.GetCustomerByEmail(req.Email)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "customer not found")
	}

	if license.CustomerID != customer.ID {
		return echo.NewHTTPError(http.StatusForbidden, "license does not belong to this email")
	}

	request, err := h.licenseService.RequestExtension(
		req.LicenseID,
		customer.ID,
		req.RequestedMonths,
		req.Reason,
		req.Email,
	)

	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message":    "extension request submitted",
		"request_id": request.ID,
		"status":     request.Status,
	})
}