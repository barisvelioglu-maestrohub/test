-- Initial schema for license server
-- SQLite compatible, can be adapted for PostgreSQL

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Licenses table
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

-- License events for audit trail
CREATE TABLE IF NOT EXISTS license_events (
    id TEXT PRIMARY KEY,
    license_id TEXT NOT NULL,
    type TEXT NOT NULL,
    actor TEXT NOT NULL,
    metadata_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (license_id) REFERENCES licenses(id)
);

-- Keys for signing
CREATE TABLE IF NOT EXISTS keys (
    kid TEXT PRIMARY KEY,
    alg TEXT NOT NULL,
    public_key TEXT NOT NULL,
    private_key_enc TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP,
    active BOOLEAN DEFAULT TRUE
);

-- Email records
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

-- Revocations
CREATE TABLE IF NOT EXISTS revocations (
    id TEXT PRIMARY KEY,
    license_id TEXT NOT NULL UNIQUE,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (license_id) REFERENCES licenses(id)
);

-- Portal sessions
CREATE TABLE IF NOT EXISTS portal_sessions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extension requests from customers
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

-- Indexes
CREATE INDEX idx_licenses_customer_id ON licenses(customer_id);
CREATE INDEX idx_licenses_valid_until ON licenses(valid_until);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_revocations_license_id ON revocations(license_id);
CREATE INDEX idx_license_events_license_id ON license_events(license_id);
CREATE INDEX idx_portal_sessions_expires_at ON portal_sessions(expires_at);