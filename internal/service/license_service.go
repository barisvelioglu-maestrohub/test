package service

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/maestrohub/license-server/internal/crypto"
	"github.com/maestrohub/license-server/internal/repository"
	"github.com/maestrohub/license-server/pkg/models"
)

type LicenseService interface {
	// Core License Operations
	CreateLicense(req *CreateLicenseRequest) (*models.License, error)
	GetLicense(id string) (*models.License, error)
	VerifyLicense(license *models.License) error
	GetCustomerLicenses(customerID string) ([]*models.License, error)

	// Customer Management
	GetOrCreateCustomer(email, companyName, userName string) (*models.Customer, error)
	GetCustomerByEmail(email string) (*models.Customer, error)

	// Admin Operations
	ExtendLicense(id string, months int) (*models.License, error)
	RevokeLicense(id string, reason string, actor string) error
	GetExpiringLicenses(days int) ([]*models.License, error)

	// Extension Request Management
	RequestExtension(licenseID, customerID string, months int, reason, requestedBy string) (*models.ExtensionRequest, error)
	ApproveExtensionRequest(requestID string, approvedMonths int, reviewedBy, notes string) error
	RejectExtensionRequest(requestID string, reviewedBy, notes string) error
	GetExtensionRequests(status *models.ExtensionRequestStatus) ([]*models.ExtensionRequest, error)
	GetExtensionRequest(requestID string) (*models.ExtensionRequest, error)

	// Logging
	LogLicenseRequest(licenseID string, requestData interface{}) error
}

type CreateLicenseRequest struct {
	CustomerID string                 `json:"customer_id" validate:"required"`
	Product    string                 `json:"product" validate:"required"`
	Duration   string                 `json:"duration"`
	Lifetime   bool                   `json:"lifetime"`
	Seats      int                    `json:"seats"`
	Features   map[string]interface{} `json:"features" validate:"required"`
	Notes      string                 `json:"notes"`
}

type licenseService struct {
	db            *repository.Database
	licenseRepo   repository.LicenseRepository
	customerRepo  repository.CustomerRepository
	extensionRepo repository.ExtensionRequestRepository
	signer        crypto.Signer
}

func NewLicenseService(
	db *repository.Database,
	licenseRepo repository.LicenseRepository,
	customerRepo repository.CustomerRepository,
	extensionRepo repository.ExtensionRequestRepository,
	signer crypto.Signer,
) LicenseService {
	return &licenseService{
		db:            db,
		licenseRepo:   licenseRepo,
		customerRepo:  customerRepo,
		extensionRepo: extensionRepo,
		signer:        signer,
	}
}

func (s *licenseService) CreateLicense(req *CreateLicenseRequest) (*models.License, error) {
	customer, err := s.customerRepo.GetByID(s.db, req.CustomerID)
	if err != nil {
		return nil, fmt.Errorf("customer not found: %w", err)
	}

	validFrom := time.Now().UTC()
	var validUntil *time.Time

	if !req.Lifetime {
		duration := parseDuration(req.Duration)
		until := validFrom.Add(duration)
		validUntil = &until
	}

	featuresJSON, err := json.Marshal(req.Features)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal features: %w", err)
	}

	license := &models.License{
		SchemaVersion: 1,
		LicenseID:     "lic_" + uuid.New().String()[:8],
		CustomerID:    customer.ID,
		Product:       req.Product,
		ValidFrom:     validFrom,
		ValidUntil:    validUntil,
		Lifetime:      req.Lifetime,
		Features:      req.Features,
		Seats:         req.Seats,
		Notes:         req.Notes,
	}

	if err := s.signer.SignLicense(license); err != nil {
		return nil, fmt.Errorf("failed to sign license: %w", err)
	}

	licenseDB := &models.LicenseDB{
		ID:            license.LicenseID,
		CustomerID:    license.CustomerID,
		Product:       license.Product,
		SchemaVersion: license.SchemaVersion,
		ValidFrom:     license.ValidFrom,
		ValidUntil:    license.ValidUntil,
		Lifetime:      license.Lifetime,
		Seats:         license.Seats,
		FeaturesJSON:  featuresJSON,
		Notes:         license.Notes,
		KID:           license.KID,
		SignatureB64:  license.SignatureB64,
		Status:        models.LicenseStatusActive,
	}

	err = s.db.InTransaction(func(tx *repository.Database) error {
		if err := s.licenseRepo.Create(tx, licenseDB); err != nil {
			return err
		}

		event := &models.LicenseEvent{
			LicenseID: license.LicenseID,
			Type:      "created",
			Actor:     "system",
			Metadata:  json.RawMessage(`{"action": "license_created"}`),
		}
		return s.licenseRepo.CreateEvent(tx, event)
	})

	if err != nil {
		return nil, fmt.Errorf("failed to create license: %w", err)
	}

	return license, nil
}

func (s *licenseService) GetLicense(id string) (*models.License, error) {
	licenseDB, err := s.licenseRepo.GetByID(s.db, id)
	if err != nil {
		return nil, err
	}

	return s.dbToLicense(licenseDB)
}

func (s *licenseService) ExtendLicense(id string, months int) (*models.License, error) {
	if months > 12 {
		return nil, fmt.Errorf("extension cannot exceed 12 months")
	}

	licenseDB, err := s.licenseRepo.GetByID(s.db, id)
	if err != nil {
		return nil, err
	}

	if licenseDB.Status != models.LicenseStatusActive {
		return nil, fmt.Errorf("can only extend active licenses")
	}

	if licenseDB.Lifetime {
		return nil, fmt.Errorf("cannot extend lifetime license")
	}

	baseTime := time.Now()
	if licenseDB.ValidUntil != nil && licenseDB.ValidUntil.After(time.Now()) {
		baseTime = *licenseDB.ValidUntil
	}

	newValidUntil := baseTime.AddDate(0, months, 0)
	licenseDB.ValidUntil = &newValidUntil

	err = s.db.InTransaction(func(tx *repository.Database) error {
		if err := s.licenseRepo.Update(tx, licenseDB); err != nil {
			return err
		}

		metadata, _ := json.Marshal(map[string]interface{}{
			"months":         months,
			"new_valid_until": newValidUntil,
		})

		event := &models.LicenseEvent{
			LicenseID: id,
			Type:      "extended",
			Actor:     "system",
			Metadata:  metadata,
		}
		return s.licenseRepo.CreateEvent(tx, event)
	})

	if err != nil {
		return nil, fmt.Errorf("failed to extend license: %w", err)
	}

	return s.dbToLicense(licenseDB)
}

func (s *licenseService) RevokeLicense(id string, reason string, actor string) error {
	licenseDB, err := s.licenseRepo.GetByID(s.db, id)
	if err != nil {
		return err
	}

	if licenseDB.Status == models.LicenseStatusRevoked {
		return fmt.Errorf("license already revoked")
	}

	return s.db.InTransaction(func(tx *repository.Database) error {
		if err := s.licenseRepo.UpdateStatus(tx, id, models.LicenseStatusRevoked); err != nil {
			return err
		}

		revocation := &models.Revocation{
			ID:        uuid.New().String(),
			LicenseID: id,
			Reason:    reason,
		}

		query := `INSERT INTO revocations (id, license_id, reason, created_at) VALUES (?, ?, ?, ?)`
		if _, err := tx.Exec(query, revocation.ID, revocation.LicenseID, revocation.Reason, time.Now()); err != nil {
			return err
		}

		metadata, _ := json.Marshal(map[string]interface{}{
			"reason": reason,
		})

		event := &models.LicenseEvent{
			LicenseID: id,
			Type:      "revoked",
			Actor:     actor,
			Metadata:  metadata,
		}
		return s.licenseRepo.CreateEvent(tx, event)
	})
}

func (s *licenseService) GetCustomerLicenses(customerID string) ([]*models.License, error) {
	licensesDB, err := s.licenseRepo.GetByCustomerID(s.db, customerID)
	if err != nil {
		return nil, err
	}

	licenses := make([]*models.License, len(licensesDB))
	for i, licDB := range licensesDB {
		lic, err := s.dbToLicense(licDB)
		if err != nil {
			return nil, err
		}
		licenses[i] = lic
	}

	return licenses, nil
}

func (s *licenseService) GetExpiringLicenses(days int) ([]*models.License, error) {
	licensesDB, err := s.licenseRepo.GetExpiring(s.db, days)
	if err != nil {
		return nil, err
	}

	licenses := make([]*models.License, len(licensesDB))
	for i, licDB := range licensesDB {
		lic, err := s.dbToLicense(licDB)
		if err != nil {
			return nil, err
		}
		licenses[i] = lic
	}

	return licenses, nil
}

func (s *licenseService) VerifyLicense(license *models.License) error {
	if err := s.signer.VerifyLicense(license); err != nil {
		return fmt.Errorf("signature verification failed: %w", err)
	}

	now := time.Now()
	if now.Before(license.ValidFrom) {
		return fmt.Errorf("license not yet valid")
	}

	if !license.Lifetime && license.ValidUntil != nil && now.After(*license.ValidUntil) {
		return fmt.Errorf("license expired")
	}

	query := `SELECT 1 FROM revocations WHERE license_id = ?`
	var exists int
	err := s.db.Get(&exists, query, license.LicenseID)
	if err == nil && exists == 1 {
		return fmt.Errorf("license revoked")
	}

	return nil
}

func (s *licenseService) dbToLicense(licDB *models.LicenseDB) (*models.License, error) {
	var features map[string]interface{}
	if err := json.Unmarshal(licDB.FeaturesJSON, &features); err != nil {
		return nil, fmt.Errorf("failed to unmarshal features: %w", err)
	}

	return &models.License{
		SchemaVersion: licDB.SchemaVersion,
		LicenseID:     licDB.ID,
		CustomerID:    licDB.CustomerID,
		Product:       licDB.Product,
		ValidFrom:     licDB.ValidFrom,
		ValidUntil:    licDB.ValidUntil,
		Lifetime:      licDB.Lifetime,
		Features:      features,
		Seats:         licDB.Seats,
		Notes:         licDB.Notes,
		KID:           licDB.KID,
		SigAlg:        "ed25519",
		SignatureB64:  licDB.SignatureB64,
	}, nil
}

func parseDuration(duration string) time.Duration {
	switch duration {
	case "1m":
		return 30 * 24 * time.Hour
	case "3m":
		return 90 * 24 * time.Hour
	case "6m":
		return 180 * 24 * time.Hour
	case "12m":
		return 365 * 24 * time.Hour
	default:
		return 30 * 24 * time.Hour
	}
}

// Extension Request Management

func (s *licenseService) RequestExtension(licenseID, customerID string, months int, reason, requestedBy string) (*models.ExtensionRequest, error) {
	// Verify license exists and belongs to customer
	license, err := s.licenseRepo.GetByID(s.db, licenseID)
	if err != nil {
		return nil, fmt.Errorf("license not found: %w", err)
	}

	if license.CustomerID != customerID {
		return nil, fmt.Errorf("license does not belong to customer")
	}

	if license.Lifetime {
		return nil, fmt.Errorf("cannot request extension for lifetime license")
	}

	if license.Status == models.LicenseStatusRevoked {
		return nil, fmt.Errorf("cannot request extension for revoked license")
	}

	// Check for existing pending request
	existingRequests, err := s.extensionRepo.GetByLicenseID(s.db, licenseID)
	if err == nil {
		for _, req := range existingRequests {
			if req.Status == models.ExtensionRequestPending {
				return nil, fmt.Errorf("extension request already pending for this license")
			}
		}
	}

	request := &models.ExtensionRequest{
		LicenseID:       licenseID,
		CustomerID:      customerID,
		RequestedMonths: months,
		Reason:          reason,
		RequestedBy:     requestedBy,
		Status:          models.ExtensionRequestPending,
	}

	err = s.db.InTransaction(func(tx *repository.Database) error {
		if err := s.extensionRepo.Create(tx, request); err != nil {
			return err
		}

		metadata, _ := json.Marshal(map[string]interface{}{
			"request_id":       request.ID,
			"requested_months": months,
			"reason":           reason,
		})

		event := &models.LicenseEvent{
			LicenseID: licenseID,
			Type:      "extension_requested",
			Actor:     requestedBy,
			Metadata:  metadata,
		}

		return s.licenseRepo.CreateEvent(tx, event)
	})

	if err != nil {
		return nil, fmt.Errorf("failed to create extension request: %w", err)
	}

	return request, nil
}

func (s *licenseService) ApproveExtensionRequest(requestID string, approvedMonths int, reviewedBy, notes string) error {
	request, err := s.extensionRepo.GetByID(s.db, requestID)
	if err != nil {
		return err
	}

	if request.Status != models.ExtensionRequestPending {
		return fmt.Errorf("request is not pending")
	}

	if approvedMonths > 12 {
		return fmt.Errorf("extension cannot exceed 12 months")
	}

	return s.db.InTransaction(func(tx *repository.Database) error {
		// Update request status
		if err := s.extensionRepo.UpdateStatus(tx, requestID, models.ExtensionRequestApproved,
			reviewedBy, notes, &approvedMonths); err != nil {
			return err
		}

		// Extend the license
		license, err := s.licenseRepo.GetByID(tx, request.LicenseID)
		if err != nil {
			return err
		}

		baseTime := time.Now()
		if license.ValidUntil != nil && license.ValidUntil.After(time.Now()) {
			baseTime = *license.ValidUntil
		}

		newValidUntil := baseTime.AddDate(0, approvedMonths, 0)
		license.ValidUntil = &newValidUntil

		if err := s.licenseRepo.Update(tx, license); err != nil {
			return err
		}

		// Create audit event
		metadata, _ := json.Marshal(map[string]interface{}{
			"request_id":      requestID,
			"approved_months": approvedMonths,
			"new_valid_until": newValidUntil,
			"notes":           notes,
		})

		event := &models.LicenseEvent{
			LicenseID: request.LicenseID,
			Type:      "extension_approved",
			Actor:     reviewedBy,
			Metadata:  metadata,
		}

		return s.licenseRepo.CreateEvent(tx, event)
	})
}

func (s *licenseService) RejectExtensionRequest(requestID string, reviewedBy, notes string) error {
	request, err := s.extensionRepo.GetByID(s.db, requestID)
	if err != nil {
		return err
	}

	if request.Status != models.ExtensionRequestPending {
		return fmt.Errorf("request is not pending")
	}

	return s.db.InTransaction(func(tx *repository.Database) error {
		if err := s.extensionRepo.UpdateStatus(tx, requestID, models.ExtensionRequestRejected,
			reviewedBy, notes, nil); err != nil {
			return err
		}

		metadata, _ := json.Marshal(map[string]interface{}{
			"request_id": requestID,
			"notes":      notes,
		})

		event := &models.LicenseEvent{
			LicenseID: request.LicenseID,
			Type:      "extension_rejected",
			Actor:     reviewedBy,
			Metadata:  metadata,
		}

		return s.licenseRepo.CreateEvent(tx, event)
	})
}

func (s *licenseService) GetExtensionRequests(status *models.ExtensionRequestStatus) ([]*models.ExtensionRequest, error) {
	if status != nil && *status == models.ExtensionRequestPending {
		return s.extensionRepo.GetPending(s.db)
	}
	return s.extensionRepo.List(s.db, status, 0, 1000)
}

func (s *licenseService) GetExtensionRequest(requestID string) (*models.ExtensionRequest, error) {
	return s.extensionRepo.GetByID(s.db, requestID)
}

// Customer Management

func (s *licenseService) GetOrCreateCustomer(email, companyName, userName string) (*models.Customer, error) {
	// Try to get existing customer
	customer, err := s.customerRepo.GetByEmail(s.db, email)
	if err == nil {
		return customer, nil
	}

	// Create new customer
	customer = &models.Customer{
		Email: email,
		Name:  companyName,
	}

	err = s.customerRepo.Create(s.db, customer)
	if err != nil {
		return nil, fmt.Errorf("failed to create customer: %w", err)
	}

	return customer, nil
}

func (s *licenseService) GetCustomerByEmail(email string) (*models.Customer, error) {
	return s.customerRepo.GetByEmail(s.db, email)
}

// Logging

func (s *licenseService) LogLicenseRequest(licenseID string, requestData interface{}) error {
	metadata, err := json.Marshal(requestData)
	if err != nil {
		return err
	}

	event := &models.LicenseEvent{
		LicenseID: licenseID,
		Type:      "license_requested",
		Actor:     "application",
		Metadata:  metadata,
	}

	return s.licenseRepo.CreateEvent(s.db, event)
}