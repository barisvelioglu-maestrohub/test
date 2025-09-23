package repository

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/maestrohub/license-server/internal/config"
)

type Database struct {
	*sqlx.DB
	config *config.DatabaseConfig
}

func NewDatabase(cfg *config.DatabaseConfig) (*Database, error) {
	db, err := sqlx.Connect(cfg.Driver, cfg.DSN)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	if cfg.Driver == "sqlite3" {
		if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
			return nil, fmt.Errorf("failed to enable foreign keys: %w", err)
		}
		if _, err := db.Exec("PRAGMA journal_mode = WAL"); err != nil {
			return nil, fmt.Errorf("failed to set journal mode: %w", err)
		}
	}

	return &Database{
		DB:     db,
		config: cfg,
	}, nil
}

func (db *Database) Migrate() error {
	schema := `
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    product TEXT NOT NULL,
    schema_version INTEGER DEFAULT 1,
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP,
    lifetime BOOLEAN DEFAULT FALSE,
    seats INTEGER DEFAULT 1,
    features_json TEXT NOT NULL,
    notes TEXT,
    kid TEXT NOT NULL,
    signature_b64 TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'expired', 'revoked')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS license_events (
    id TEXT PRIMARY KEY,
    license_id TEXT NOT NULL,
    type TEXT NOT NULL,
    actor TEXT NOT NULL,
    metadata_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (license_id) REFERENCES licenses(id)
);

CREATE TABLE IF NOT EXISTS keys (
    kid TEXT PRIMARY KEY,
    alg TEXT NOT NULL,
    public_key TEXT NOT NULL,
    private_key_enc TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP,
    active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY,
    license_id TEXT NOT NULL,
    to_email TEXT NOT NULL,
    template TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (license_id) REFERENCES licenses(id)
);

CREATE TABLE IF NOT EXISTS revocations (
    id TEXT PRIMARY KEY,
    license_id TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (license_id) REFERENCES licenses(id)
);

CREATE TABLE IF NOT EXISTS portal_sessions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    app_id TEXT UNIQUE NOT NULL,
    app_name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    rate_limit INTEGER DEFAULT 60,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP,
    created_by TEXT NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS api_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT NOT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    endpoint TEXT,
    status_code INTEGER,
    FOREIGN KEY (app_id) REFERENCES api_keys(app_id)
);

CREATE TABLE IF NOT EXISTS extension_requests (
    id TEXT PRIMARY KEY,
    license_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    requested_months INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by TEXT NOT NULL,
    reviewed_by TEXT,
    review_notes TEXT,
    approved_months INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    FOREIGN KEY (license_id) REFERENCES licenses(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_licenses_customer_id ON licenses(customer_id);
CREATE INDEX IF NOT EXISTS idx_extension_requests_status ON extension_requests(status);
CREATE INDEX IF NOT EXISTS idx_extension_requests_license ON extension_requests(license_id);
CREATE INDEX IF NOT EXISTS idx_licenses_valid_until ON licenses(valid_until);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_revocations_license_id ON revocations(license_id);
CREATE INDEX IF NOT EXISTS idx_license_events_license_id ON license_events(license_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires_at ON portal_sessions(expires_at);`

	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	return nil
}

func (db *Database) Ping() error {
	return db.DB.Ping()
}

func (db *Database) InTransaction(fn func(*sqlx.Tx) error) error {
	tx, err := db.Beginx()
	if err != nil {
		return err
	}

	defer func() {
		if p := recover(); p != nil {
			tx.Rollback()
			panic(p)
		}
	}()

	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}

func (db *Database) Close() error {
	return db.DB.Close()
}

type Scanner interface {
	Scan(dest ...interface{}) error
}

type Querier interface {
	Get(dest interface{}, query string, args ...interface{}) error
	Select(dest interface{}, query string, args ...interface{}) error
	Exec(query string, args ...interface{}) (sql.Result, error)
	NamedExec(query string, arg interface{}) (sql.Result, error)
	Rebind(query string) string
}

func NullTime(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *t, Valid: true}
}

func TimePtr(nt sql.NullTime) *time.Time {
	if !nt.Valid {
		return nil
	}
	return &nt.Time
}