-- API Keys table for application authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    app_id TEXT UNIQUE NOT NULL,
    app_name TEXT NOT NULL,
    key_prefix TEXT NOT NULL, -- First 12 chars for indexing
    key_hash TEXT NOT NULL,   -- Full API key (hashed in production)
    rate_limit INTEGER DEFAULT 60, -- Requests per minute
    active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    created_by TEXT NOT NULL,
    notes TEXT,

    INDEX idx_api_keys_prefix (key_prefix),
    INDEX idx_api_keys_active (active)
);

-- API request tracking for rate limiting
CREATE TABLE IF NOT EXISTS api_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id TEXT NOT NULL,
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    endpoint TEXT,
    status_code INTEGER,

    FOREIGN KEY (app_id) REFERENCES api_keys(app_id),
    INDEX idx_api_requests_app_time (app_id, requested_at)
);

-- Insert default API key for testing (REMOVE IN PRODUCTION)
INSERT INTO api_keys (app_id, app_name, key_prefix, key_hash, rate_limit, created_by, notes)
VALUES (
    'app_default_001',
    'Default Application',
    'sk_test_1234',
    'mhub_sk_test_1234567890abcdefghijklmnopqrstuv',
    100,
    'system',
    'Default API key for testing - REMOVE IN PRODUCTION'
);