package models

import (
	"encoding/json"
	"time"
)

type License struct {
	SchemaVersion int                    `json:"schema_version"`
	LicenseID     string                 `json:"license_id"`
	CustomerID    string                 `json:"customer_id"`
	Product       string                 `json:"product"`
	ValidFrom     time.Time              `json:"valid_from"`
	ValidUntil    *time.Time             `json:"valid_until,omitempty"`
	Lifetime      bool                   `json:"lifetime"`
	Features      map[string]interface{} `json:"features"`
	Seats         int                    `json:"seats,omitempty"`
	Notes         string                 `json:"notes,omitempty"`
	KID           string                 `json:"kid"`
	SigAlg        string                 `json:"sig_alg"`
	SignatureB64  string                 `json:"signature_b64,omitempty"`
}

type LicenseStatus string

const (
	LicenseStatusDraft   LicenseStatus = "draft"
	LicenseStatusActive  LicenseStatus = "active"
	LicenseStatusExpired LicenseStatus = "expired"
	LicenseStatusRevoked LicenseStatus = "revoked"
)

type LicenseDB struct {
	ID           string          `db:"id"`
	CustomerID   string          `db:"customer_id"`
	Product      string          `db:"product"`
	SchemaVersion int            `db:"schema_version"`
	ValidFrom    time.Time       `db:"valid_from"`
	ValidUntil   *time.Time      `db:"valid_until"`
	Lifetime     bool            `db:"lifetime"`
	Seats        int             `db:"seats"`
	FeaturesJSON json.RawMessage `db:"features_json"`
	Notes        string          `db:"notes"`
	KID          string          `db:"kid"`
	SignatureB64 string          `db:"signature_b64"`
	Status       LicenseStatus   `db:"status"`
	CreatedAt    time.Time       `db:"created_at"`
	UpdatedAt    time.Time       `db:"updated_at"`
}

type Customer struct {
	ID        string    `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	Email     string    `db:"email" json:"email"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type LicenseEvent struct {
	ID         string          `db:"id"`
	LicenseID  string          `db:"license_id"`
	Type       string          `db:"type"`
	Actor      string          `db:"actor"`
	Metadata   json.RawMessage `db:"metadata_json"`
	CreatedAt  time.Time       `db:"created_at"`
}

type Key struct {
	KID            string     `db:"kid"`
	Alg            string     `db:"alg"`
	PublicKey      string     `db:"public_key"`
	PrivateKeyEnc  string     `db:"private_key_enc"`
	CreatedAt      time.Time  `db:"created_at"`
	RotatedAt      *time.Time `db:"rotated_at"`
	Active         bool       `db:"active"`
}

type Revocation struct {
	ID        string    `db:"id"`
	LicenseID string    `db:"license_id"`
	Reason    string    `db:"reason"`
	CreatedAt time.Time `db:"created_at"`
}

type EmailRecord struct {
	ID         string    `db:"id"`
	LicenseID  string    `db:"license_id"`
	ToEmail    string    `db:"to_email"`
	Template   string    `db:"template"`
	Status     string    `db:"status"`
	ProviderID string    `db:"provider_id"`
	CreatedAt  time.Time `db:"created_at"`
}

type PortalSession struct {
	ID         string    `db:"id"`
	CustomerID string    `db:"customer_id"`
	TokenHash  string    `db:"token_hash"`
	ExpiresAt  time.Time `db:"expires_at"`
	CreatedAt  time.Time `db:"created_at"`
}

type ExtensionRequestStatus string

const (
	ExtensionRequestPending  ExtensionRequestStatus = "pending"
	ExtensionRequestApproved ExtensionRequestStatus = "approved"
	ExtensionRequestRejected ExtensionRequestStatus = "rejected"
)

type ExtensionRequest struct {
	ID              string                 `db:"id" json:"id"`
	LicenseID       string                 `db:"license_id" json:"license_id"`
	CustomerID      string                 `db:"customer_id" json:"customer_id"`
	RequestedMonths int                    `db:"requested_months" json:"requested_months"`
	Reason          string                 `db:"reason" json:"reason"`
	Status          ExtensionRequestStatus `db:"status" json:"status"`
	RequestedBy     string                 `db:"requested_by" json:"requested_by"`
	ReviewedBy      *string                `db:"reviewed_by" json:"reviewed_by,omitempty"`
	ReviewNotes     *string                `db:"review_notes" json:"review_notes,omitempty"`
	ApprovedMonths  *int                   `db:"approved_months" json:"approved_months,omitempty"`
	CreatedAt       time.Time              `db:"created_at" json:"created_at"`
	ReviewedAt      *time.Time             `db:"reviewed_at" json:"reviewed_at,omitempty"`
}