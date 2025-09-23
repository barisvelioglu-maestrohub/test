package api

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
	"github.com/maestrohub/license-server/internal/email"
	"github.com/maestrohub/license-server/internal/service"
	"github.com/maestrohub/license-server/pkg/models"
)

// List of public email domains to block
var publicEmailDomains = []string{
	"gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
	"aol.com", "icloud.com", "mail.com", "protonmail.com",
	"yandex.com", "qq.com", "163.com", "126.com",
	"live.com", "msn.com", "me.com", "mac.com",
}

type LicenseRequestHandler struct {
	licenseService service.LicenseService
	emailService   email.EmailService
	validator      *validator.Validate
}

func NewLicenseRequestHandler(
	licenseService service.LicenseService,
	emailService email.EmailService,
) *LicenseRequestHandler {
	return &LicenseRequestHandler{
		licenseService: licenseService,
		emailService:   emailService,
		validator:      validator.New(),
	}
}

// RequestLicense - Called by the APPLICATION when user requests a license
type LicenseRequestPayload struct {
	Email       string `json:"email" validate:"required,email"`
	CompanyName string `json:"company_name" validate:"required"`
	UserName    string `json:"user_name" validate:"required"`
	Role        string `json:"role" validate:"required"`
	Purpose     string `json:"purpose" validate:"required"`
	Product     string `json:"product" validate:"required"`
	OrderNumber string `json:"order_number,omitempty"` // Optional sales reference
}

func (h *LicenseRequestHandler) RequestLicense(c echo.Context) error {
	var req LicenseRequestPayload
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if err := h.validator.Struct(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Validate email is not public domain
	if err := h.validateCompanyEmail(req.Email); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	// Check if customer already has an active license
	existingLicense, err := h.checkExistingLicense(req.Email, req.Product)
	if err == nil && existingLicense != nil {
		// If license exists and is valid, resend it
		if existingLicense.Status == models.LicenseStatusActive {
			// Resend existing license
			if err := h.emailService.SendLicense(req.Email, existingLicense, ""); err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "failed to send license email")
			}
			return c.JSON(http.StatusOK, map[string]string{
				"message": "existing license sent to your email",
				"status":  "license_resent",
			})
		}
	}

	// Create new customer or get existing
	customer, err := h.licenseService.GetOrCreateCustomer(req.Email, req.CompanyName, req.UserName)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create customer")
	}

	// Create license request (30-day trial by default)
	licenseReq := &service.CreateLicenseRequest{
		CustomerID: customer.ID,
		Product:    req.Product,
		Duration:   "1m", // 30-day trial
		Lifetime:   false,
		Seats:      1, // Single seat for trial
		Features:   h.getTrialFeatures(req.Product),
		Notes:      formatNotes(req),
	}

	// Create and sign license
	license, err := h.licenseService.CreateLicense(licenseReq)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create license")
	}

	// Send license via email
	if err := h.emailService.SendLicense(req.Email, license, ""); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to send license email")
	}

	// Log the request
	h.licenseService.LogLicenseRequest(license.LicenseID, req)

	return c.JSON(http.StatusCreated, map[string]string{
		"message": "license created and sent to your email",
		"status":  "success",
	})
}

func (h *LicenseRequestHandler) validateCompanyEmail(email string) error {
	domain := strings.ToLower(strings.Split(email, "@")[1])

	for _, publicDomain := range publicEmailDomains {
		if domain == publicDomain {
			return fmt.Errorf("please use a company email address, public email domains are not allowed")
		}
	}

	return nil
}

func (h *LicenseRequestHandler) checkExistingLicense(email, product string) (*models.License, error) {
	// Check if customer exists
	customer, err := h.licenseService.GetCustomerByEmail(email)
	if err != nil {
		return nil, err
	}

	// Get customer's licenses for this product
	licenses, err := h.licenseService.GetCustomerLicenses(customer.ID)
	if err != nil {
		return nil, err
	}

	// Find active license for the product
	for _, license := range licenses {
		if license.Product == product {
			// Check if still valid
			if license.Lifetime || (license.ValidUntil != nil && license.ValidUntil.After(time.Now())) {
				return license, nil
			}
		}
	}

	return nil, fmt.Errorf("no active license found")
}

func (h *LicenseRequestHandler) getTrialFeatures(product string) map[string]interface{} {
	// Define trial features based on product
	// This can be customized per product
	return map[string]interface{}{
		"trial":        true,
		"dashboards":   true,
		"alerts":       false,
		"reports_tier": "basic",
		"max_devices":  100,
		"support":      "community",
	}
}

func formatNotes(req LicenseRequestPayload) string {
	notes := fmt.Sprintf("Trial License Request\n")
	notes += fmt.Sprintf("Company: %s\n", req.CompanyName)
	notes += fmt.Sprintf("User: %s\n", req.UserName)
	notes += fmt.Sprintf("Role: %s\n", req.Role)
	notes += fmt.Sprintf("Purpose: %s\n", req.Purpose)
	if req.OrderNumber != "" {
		notes += fmt.Sprintf("Order: %s\n", req.OrderNumber)
	}
	notes += fmt.Sprintf("Requested: %s", time.Now().Format("2006-01-02 15:04:05"))
	return notes
}