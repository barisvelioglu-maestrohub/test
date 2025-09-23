# Production Deployment Checklist

## ✅ Complete Implementation Status

### Core Features
- ✅ License creation and management
- ✅ Email validation (company domains only)
- ✅ Ed25519 cryptographic signatures
- ✅ Email delivery via SMTP
- ✅ Extension request workflow
- ✅ License verification and revocation

### Security Features
- ✅ API key authentication for applications
- ✅ JWT authentication for admins
- ✅ Rate limiting (per API key and per IP)
- ✅ CORS protection
- ✅ Email domain validation

### Critical Components
- ✅ Admin authentication endpoints
- ✅ API key management
- ✅ Initial admin user setup
- ✅ Database migration system
- ✅ Email service implementation

## 🚀 Pre-Production Steps

### 1. Initial Setup
```bash
# Clone and build
git clone https://github.com/maestrohub/license-server
cd license-server
go build -o license-server cmd/server/main.go

# Build admin tool
go build -o admin-init cmd/admin/main.go
```

### 2. Database Setup
```bash
# For PostgreSQL production (recommended)
# Update config.yaml:
database:
  driver: "postgres"
  dsn: "postgres://user:password@localhost/licensedb?sslmode=require"

# For SQLite (development only)
database:
  driver: "sqlite3"
  dsn: "./license.db"
```

### 3. Create First Admin User
```bash
# Run the admin initialization tool
./admin-init \
  -email "admin@maestrohub.com" \
  -name "System Admin" \
  -config ./config.yaml

# You'll be prompted for a secure password
```

### 4. Create First API Key
```bash
# Login as admin
curl -X POST https://license.maestrohub.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@maestrohub.com",
    "password": "your-password"
  }'

# Use the returned token to create API key
curl -X POST https://license.maestrohub.com/api/v1/admin/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Production App",
    "rate_limit": 100,
    "notes": "Main production application"
  }'

# Save the returned API key securely!
```

## 📋 Production Configuration Checklist

### Environment Variables (REQUIRED)
```bash
# Security (MUST CHANGE)
LICENSE_JWT_SECRET=<generate-strong-random-secret-min-32-chars>
LICENSE_DB_ENCRYPTION_KEY=<generate-32-byte-key>

# Database (PostgreSQL recommended)
LICENSE_DATABASE_DSN=postgres://user:pass@host/dbname?sslmode=require

# Email Configuration
LICENSE_EMAIL_SMTP_HOST=smtp.gmail.com
LICENSE_EMAIL_SMTP_PORT=587
LICENSE_EMAIL_SMTP_USER=noreply@maestrohub.com
LICENSE_EMAIL_SMTP_PASSWORD=<app-specific-password>
LICENSE_EMAIL_FROM_EMAIL=noreply@maestrohub.com
LICENSE_EMAIL_FROM_NAME="MaestroHUB Licensing"

# Server Configuration
LICENSE_SERVER_PORT=8080
LICENSE_SERVER_HOST=0.0.0.0
LICENSE_SERVER_BASE_URL=https://license.maestrohub.com
LICENSE_SERVER_ENVIRONMENT=production
```

### config.yaml Updates
```yaml
server:
  environment: "production"  # MUST be production
  base_url: "https://license.maestrohub.com"  # Your actual domain

security:
  rate_limit_per_minute: 60
  allowed_origins:
    - "https://app.maestrohub.com"  # Your application domains
    # Remove localhost entries!

jwt:
  secret: "${LICENSE_JWT_SECRET}"  # Use env variable
  admin_expiry: "8h"
```

## 🔒 Security Hardening

### 1. TLS/HTTPS Setup
```nginx
# Nginx configuration example
server {
    listen 443 ssl http2;
    server_name license.maestrohub.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Firewall Rules
```bash
# Allow only HTTPS traffic
ufw allow 443/tcp
ufw allow 22/tcp  # SSH
ufw enable
```

### 3. Database Security
```sql
-- Create dedicated user for app
CREATE USER licenseapp WITH PASSWORD 'strong-password';
GRANT ALL ON DATABASE licensedb TO licenseapp;

-- Enable SSL
-- Add ?sslmode=require to connection string
```

## 🔍 Monitoring Setup

### 1. Health Checks
```bash
# Basic health check
curl https://license.maestrohub.com/healthz

# Readiness check (includes DB)
curl https://license.maestrohub.com/readyz

# Prometheus metrics
curl https://license.maestrohub.com/metrics
```

### 2. Logging
```bash
# Configure structured logging
logging:
  level: "info"  # Use "error" in production
  format: "json"
  output_path: "/var/log/license-server/app.log"
```

### 3. Alerts to Set Up
- High error rate (> 1% of requests)
- Database connection failures
- Email delivery failures
- Rate limit violations
- Failed admin login attempts
- API key usage anomalies

## 🚦 Testing Before Production

### 1. API Key Authentication Test
```bash
# Should fail without API key
curl -X POST https://license.maestrohub.com/api/v1/license/request \
  -d '{"email":"test@company.com"}'

# Should work with valid API key
curl -X POST https://license.maestrohub.com/api/v1/license/request \
  -H "X-API-Key: mhub_sk_live_xxxxx" \
  -d '{"email":"test@company.com", ...}'
```

### 2. Email Validation Test
```bash
# Should fail (public domain)
curl -X POST https://license.maestrohub.com/api/v1/license/request \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"email":"user@gmail.com", ...}'

# Should succeed (company domain)
curl -X POST https://license.maestrohub.com/api/v1/license/request \
  -H "X-API-Key: YOUR_KEY" \
  -d '{"email":"user@company.com", ...}'
```

### 3. Rate Limiting Test
```bash
# Run this script to test rate limiting
for i in {1..100}; do
  curl -X POST https://license.maestrohub.com/api/v1/license/request \
    -H "X-API-Key: YOUR_KEY" \
    -d '{"email":"test@company.com"}' &
done
# Should see 429 errors after rate limit
```

## 🔄 Backup Strategy

### Database Backups
```bash
# PostgreSQL backup script
#!/bin/bash
pg_dump licensedb > backup_$(date +%Y%m%d_%H%M%S).sql

# Automate with cron
0 2 * * * /path/to/backup_script.sh
```

### Key Backup
```bash
# Backup signing keys (CRITICAL!)
SELECT kid, public_key, private_key_enc
FROM keys
WHERE active = true;
# Store securely offline
```

## 📝 Final Deployment Steps

### 1. Systemd Service
```ini
# /etc/systemd/system/license-server.service
[Unit]
Description=MaestroHUB License Server
After=network.target postgresql.service

[Service]
Type=simple
User=licenseserver
Group=licenseserver
WorkingDirectory=/opt/license-server
ExecStart=/opt/license-server/license-server -config /opt/license-server/config.yaml
Restart=always
RestartSec=10
StandardOutput=append:/var/log/license-server/stdout.log
StandardError=append:/var/log/license-server/stderr.log

[Install]
WantedBy=multi-user.target
```

### 2. Start Service
```bash
systemctl daemon-reload
systemctl enable license-server
systemctl start license-server
systemctl status license-server
```

### 3. Verify Deployment
```bash
# Check logs
journalctl -u license-server -f

# Test endpoints
curl https://license.maestrohub.com/healthz
curl https://license.maestrohub.com/readyz
```

## ⚠️ Critical Reminders

1. **CHANGE ALL DEFAULT SECRETS**
2. **USE POSTGRESQL IN PRODUCTION** (not SQLite)
3. **ENABLE HTTPS/TLS**
4. **BACKUP DATABASE REGULARLY**
5. **MONITOR ERROR RATES**
6. **ROTATE API KEYS EVERY 90 DAYS**
7. **REVIEW AUDIT LOGS WEEKLY**
8. **TEST DISASTER RECOVERY**

## 📞 Support Contacts

- Technical Issues: tech@maestrohub.com
- Security Issues: security@maestrohub.com
- Emergency: +1-XXX-XXX-XXXX

## Version Information

- Current Version: 1.0.0
- Go Version: 1.21+
- Database: PostgreSQL 13+ (production)
- Deployment Date: [INSERT DATE]

## Post-Deployment Monitoring

### First 24 Hours
- [ ] Monitor error rates
- [ ] Check email delivery success
- [ ] Verify rate limiting works
- [ ] Review access logs
- [ ] Test backup restoration

### First Week
- [ ] Analyze usage patterns
- [ ] Fine-tune rate limits
- [ ] Review security logs
- [ ] Update documentation
- [ ] Train support team

---
Last Updated: [INSERT DATE]
Deployment Engineer: [INSERT NAME]