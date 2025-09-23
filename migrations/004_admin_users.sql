-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
    active BOOLEAN DEFAULT true,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_admin_users_email (email),
    INDEX idx_admin_users_active (active)
);

-- Default admin user (CHANGE PASSWORD IMMEDIATELY)
-- Password: Admin@123456
INSERT INTO admin_users (id, email, name, password_hash, role, active)
VALUES (
    'admin_default_001',
    'admin@maestrohub.com',
    'System Admin',
    '$2a$10$YourHashedPasswordHere', -- This will be replaced by bcrypt hash
    'admin',
    true
) ON CONFLICT (email) DO NOTHING;