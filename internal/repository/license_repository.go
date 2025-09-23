package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/maestrohub/license-server/pkg/models"
)

type LicenseRepository interface {
	Create(tx Querier, license *models.LicenseDB) error
	GetByID(tx Querier, id string) (*models.LicenseDB, error)
	GetByCustomerID(tx Querier, customerID string) ([]*models.LicenseDB, error)
	Update(tx Querier, license *models.LicenseDB) error
	UpdateStatus(tx Querier, id string, status models.LicenseStatus) error
	List(tx Querier, offset, limit int) ([]*models.LicenseDB, error)
	GetExpiring(tx Querier, days int) ([]*models.LicenseDB, error)
	CreateEvent(tx Querier, event *models.LicenseEvent) error
	GetEvents(tx Querier, licenseID string) ([]*models.LicenseEvent, error)
}

type licenseRepository struct {
	db *Database
}

func NewLicenseRepository(db *Database) LicenseRepository {
	return &licenseRepository{db: db}
}

func (r *licenseRepository) Create(tx Querier, license *models.LicenseDB) error {
	if license.ID == "" {
		license.ID = "lic_" + uuid.New().String()[:8]
	}

	license.CreatedAt = time.Now()
	license.UpdatedAt = time.Now()

	query := `
		INSERT INTO licenses (
			id, customer_id, product, schema_version, valid_from, valid_until,
			lifetime, seats, features_json, notes, kid, signature_b64, status,
			created_at, updated_at
		) VALUES (
			:id, :customer_id, :product, :schema_version, :valid_from, :valid_until,
			:lifetime, :seats, :features_json, :notes, :kid, :signature_b64, :status,
			:created_at, :updated_at
		)`

	_, err := tx.NamedExec(query, license)
	if err != nil {
		return fmt.Errorf("failed to create license: %w", err)
	}

	return nil
}

func (r *licenseRepository) GetByID(tx Querier, id string) (*models.LicenseDB, error) {
	var license models.LicenseDB
	query := `
		SELECT id, customer_id, product, schema_version, valid_from, valid_until,
			   lifetime, seats, features_json, notes, kid, signature_b64, status,
			   created_at, updated_at
		FROM licenses
		WHERE id = ?`

	err := tx.Get(&license, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("license not found")
		}
		return nil, fmt.Errorf("failed to get license: %w", err)
	}

	return &license, nil
}

func (r *licenseRepository) GetByCustomerID(tx Querier, customerID string) ([]*models.LicenseDB, error) {
	var licenses []*models.LicenseDB
	query := `
		SELECT id, customer_id, product, schema_version, valid_from, valid_until,
			   lifetime, seats, features_json, notes, kid, signature_b64, status,
			   created_at, updated_at
		FROM licenses
		WHERE customer_id = ?
		ORDER BY created_at DESC`

	err := tx.Select(&licenses, query, customerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get licenses: %w", err)
	}

	return licenses, nil
}

func (r *licenseRepository) Update(tx Querier, license *models.LicenseDB) error {
	license.UpdatedAt = time.Now()

	query := `
		UPDATE licenses SET
			valid_until = :valid_until,
			lifetime = :lifetime,
			seats = :seats,
			features_json = :features_json,
			notes = :notes,
			status = :status,
			updated_at = :updated_at
		WHERE id = :id`

	result, err := tx.NamedExec(query, license)
	if err != nil {
		return fmt.Errorf("failed to update license: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("license not found")
	}

	return nil
}

func (r *licenseRepository) UpdateStatus(tx Querier, id string, status models.LicenseStatus) error {
	query := `UPDATE licenses SET status = ?, updated_at = ? WHERE id = ?`

	result, err := tx.Exec(query, status, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update status: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("license not found")
	}

	return nil
}

func (r *licenseRepository) List(tx Querier, offset, limit int) ([]*models.LicenseDB, error) {
	var licenses []*models.LicenseDB
	query := `
		SELECT id, customer_id, product, schema_version, valid_from, valid_until,
			   lifetime, seats, features_json, notes, kid, signature_b64, status,
			   created_at, updated_at
		FROM licenses
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?`

	err := tx.Select(&licenses, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list licenses: %w", err)
	}

	return licenses, nil
}

func (r *licenseRepository) GetExpiring(tx Querier, days int) ([]*models.LicenseDB, error) {
	var licenses []*models.LicenseDB
	expiryDate := time.Now().AddDate(0, 0, days)

	query := `
		SELECT id, customer_id, product, schema_version, valid_from, valid_until,
			   lifetime, seats, features_json, notes, kid, signature_b64, status,
			   created_at, updated_at
		FROM licenses
		WHERE status = 'active'
			AND lifetime = false
			AND valid_until <= ?
			AND valid_until > ?
		ORDER BY valid_until ASC`

	err := tx.Select(&licenses, query, expiryDate, time.Now())
	if err != nil {
		return nil, fmt.Errorf("failed to get expiring licenses: %w", err)
	}

	return licenses, nil
}

func (r *licenseRepository) CreateEvent(tx Querier, event *models.LicenseEvent) error {
	if event.ID == "" {
		event.ID = uuid.New().String()
	}
	event.CreatedAt = time.Now()

	query := `
		INSERT INTO license_events (id, license_id, type, actor, metadata_json, created_at)
		VALUES (:id, :license_id, :type, :actor, :metadata_json, :created_at)`

	_, err := tx.NamedExec(query, event)
	if err != nil {
		return fmt.Errorf("failed to create event: %w", err)
	}

	return nil
}

func (r *licenseRepository) GetEvents(tx Querier, licenseID string) ([]*models.LicenseEvent, error) {
	var events []*models.LicenseEvent
	query := `
		SELECT id, license_id, type, actor, metadata_json, created_at
		FROM license_events
		WHERE license_id = ?
		ORDER BY created_at DESC`

	err := tx.Select(&events, query, licenseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get events: %w", err)
	}

	return events, nil
}

type CustomerRepository interface {
	Create(tx Querier, customer *models.Customer) error
	GetByID(tx Querier, id string) (*models.Customer, error)
	GetByEmail(tx Querier, email string) (*models.Customer, error)
	List(tx Querier, offset, limit int) ([]*models.Customer, error)
	Update(tx Querier, customer *models.Customer) error
}

type customerRepository struct {
	db *Database
}

func NewCustomerRepository(db *Database) CustomerRepository {
	return &customerRepository{db: db}
}

func (r *customerRepository) Create(tx Querier, customer *models.Customer) error {
	if customer.ID == "" {
		customer.ID = "cust_" + uuid.New().String()[:8]
	}
	customer.CreatedAt = time.Now()

	query := `
		INSERT INTO customers (id, name, email, created_at)
		VALUES (:id, :name, :email, :created_at)`

	_, err := tx.NamedExec(query, customer)
	if err != nil {
		return fmt.Errorf("failed to create customer: %w", err)
	}

	return nil
}

func (r *customerRepository) GetByID(tx Querier, id string) (*models.Customer, error) {
	var customer models.Customer
	query := `SELECT id, name, email, created_at FROM customers WHERE id = ?`

	err := tx.Get(&customer, query, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("customer not found")
		}
		return nil, fmt.Errorf("failed to get customer: %w", err)
	}

	return &customer, nil
}

func (r *customerRepository) GetByEmail(tx Querier, email string) (*models.Customer, error) {
	var customer models.Customer
	query := `SELECT id, name, email, created_at FROM customers WHERE email = ?`

	err := tx.Get(&customer, query, email)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("customer not found")
		}
		return nil, fmt.Errorf("failed to get customer: %w", err)
	}

	return &customer, nil
}

func (r *customerRepository) List(tx Querier, offset, limit int) ([]*models.Customer, error) {
	var customers []*models.Customer
	query := `
		SELECT id, name, email, created_at
		FROM customers
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?`

	err := tx.Select(&customers, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list customers: %w", err)
	}

	return customers, nil
}

func (r *customerRepository) Update(tx Querier, customer *models.Customer) error {
	query := `UPDATE customers SET name = :name, email = :email WHERE id = :id`

	result, err := tx.NamedExec(query, customer)
	if err != nil {
		return fmt.Errorf("failed to update customer: %w", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}

	if rows == 0 {
		return fmt.Errorf("customer not found")
	}

	return nil
}