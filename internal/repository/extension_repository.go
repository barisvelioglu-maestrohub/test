package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/maestrohub/license-server/pkg/models"
)

type ExtensionRequestRepository interface {
	Create(tx Querier, req *models.ExtensionRequest) error
	GetByID(tx Querier, id string) (*models.ExtensionRequest, error)
	GetByLicenseID(tx Querier, licenseID string) ([]*models.ExtensionRequest, error)
	GetByCustomerID(tx Querier, customerID string) ([]*models.ExtensionRequest, error)
	GetPending(tx Querier) ([]*models.ExtensionRequest, error)
	UpdateStatus(tx Querier, id string, status models.ExtensionRequestStatus, reviewedBy string, notes string, approvedMonths *int) error
	List(tx Querier, status *models.ExtensionRequestStatus, offset, limit int) ([]*models.ExtensionRequest, error)
}

type extensionRequestRepository struct {
	db *Database
}

func NewExtensionRequestRepository(db *Database) ExtensionRequestRepository {
	return &extensionRequestRepository{db: db}
}

func (r *extensionRequestRepository) Create(tx Querier, req *models.ExtensionRequest) error {
	if req.ID == "" {
		req.ID = "ext_req_" + uuid.New().String()[:8]
	}
	req.CreatedAt = time.Now()
	req.Status = models.ExtensionRequestPending

	query := `
		INSERT INTO extension_requests (
			id, license_id, customer_id, requested_months, reason,
			status, requested_by, created_at
		) VALUES (
			:id, :license_id, :customer_id, :requested_months, :reason,
			:status, :requested_by, :created_at
		)`

	_, err := tx.NamedExec(query, req)
	if err != nil {
		return fmt.Errorf("failed to create extension request: %w", err)
	}

	return nil
}

func (r *extensionRequestRepository) GetByID(tx Querier, id string) (*models.ExtensionRequest, error) {
	var req models.ExtensionRequest
	query := `
		SELECT id, license_id, customer_id, requested_months, reason, status,
			   requested_by, reviewed_by, review_notes, approved_months,
			   created_at, reviewed_at
		FROM extension_requests
		WHERE id = ?`

	err := tx.Get(&req, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("extension request not found")
		}
		return nil, fmt.Errorf("failed to get extension request: %w", err)
	}

	return &req, nil
}

func (r *extensionRequestRepository) GetByLicenseID(tx Querier, licenseID string) ([]*models.ExtensionRequest, error) {
	var requests []*models.ExtensionRequest
	query := `
		SELECT id, license_id, customer_id, requested_months, reason, status,
			   requested_by, reviewed_by, review_notes, approved_months,
			   created_at, reviewed_at
		FROM extension_requests
		WHERE license_id = ?
		ORDER BY created_at DESC`

	err := tx.Select(&requests, query, licenseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get extension requests: %w", err)
	}

	return requests, nil
}

func (r *extensionRequestRepository) GetByCustomerID(tx Querier, customerID string) ([]*models.ExtensionRequest, error) {
	var requests []*models.ExtensionRequest
	query := `
		SELECT id, license_id, customer_id, requested_months, reason, status,
			   requested_by, reviewed_by, review_notes, approved_months,
			   created_at, reviewed_at
		FROM extension_requests
		WHERE customer_id = ?
		ORDER BY created_at DESC`

	err := tx.Select(&requests, query, customerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get extension requests: %w", err)
	}

	return requests, nil
}

func (r *extensionRequestRepository) GetPending(tx Querier) ([]*models.ExtensionRequest, error) {
	var requests []*models.ExtensionRequest
	query := `
		SELECT id, license_id, customer_id, requested_months, reason, status,
			   requested_by, reviewed_by, review_notes, approved_months,
			   created_at, reviewed_at
		FROM extension_requests
		WHERE status = 'pending'
		ORDER BY created_at ASC`

	err := tx.Select(&requests, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get pending requests: %w", err)
	}

	return requests, nil
}

func (r *extensionRequestRepository) UpdateStatus(tx Querier, id string, status models.ExtensionRequestStatus, reviewedBy string, notes string, approvedMonths *int) error {
	reviewedAt := time.Now()

	query := `
		UPDATE extension_requests SET
			status = ?,
			reviewed_by = ?,
			review_notes = ?,
			approved_months = ?,
			reviewed_at = ?
		WHERE id = ?`

	result, err := tx.Exec(query, status, reviewedBy, notes, approvedMonths, reviewedAt, id)
	if err != nil {
		return fmt.Errorf("failed to update extension request: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("extension request not found")
	}

	return nil
}

func (r *extensionRequestRepository) List(tx Querier, status *models.ExtensionRequestStatus, offset, limit int) ([]*models.ExtensionRequest, error) {
	var requests []*models.ExtensionRequest

	query := `
		SELECT id, license_id, customer_id, requested_months, reason, status,
			   requested_by, reviewed_by, review_notes, approved_months,
			   created_at, reviewed_at
		FROM extension_requests`

	args := []interface{}{}

	if status != nil {
		query += " WHERE status = ?"
		args = append(args, *status)
	}

	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	err := tx.Select(&requests, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list extension requests: %w", err)
	}

	return requests, nil
}