# License Server API Endpoints - Complete Guide

## Overview

The License Server provides 18 endpoints organized into 5 categories:
1. **Public Endpoints** - No authentication required
2. **Application Endpoints** - Require API key
3. **Authentication Endpoints** - For admin login
4. **Admin Endpoints** - Require JWT token
5. **Health Endpoints** - System monitoring

---

## 🌐 PUBLIC ENDPOINTS (No Authentication)

These endpoints are accessible without any authentication because they need to be available for offline license verification and system information.

### 1. Get Public Key
**Endpoint:** `GET /.well-known/licensing-public-key`
**Authentication:** None
**Purpose:** Provides the public key for offline license signature verification

**Why Public?** Applications need this to verify licenses when the server is unreachable.

**Responsibility:**
- Returns the Ed25519 public key in PEM format
- Used by applications to verify license signatures offline
- Cached by applications for performance

**Use Case:**
```
Application starts → Can't reach server → Uses cached public key → Verifies license locally
```

**Response Example:**
```
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAGqBxJXawP6Hgzk...
-----END PUBLIC KEY-----
```

---

### 2. Get Revoked Licenses
**Endpoint:** `GET /api/v1/revocations`
**Authentication:** None
**Purpose:** Returns list of revoked license IDs

**Why Public?** Applications need to check if their license was revoked, even offline.

**Responsibility:**
- Returns array of revoked license IDs
- Acts as a Certificate Revocation List (CRL)
- Should be checked periodically by applications

**Use Case:**
```
Application running → Hourly check → Downloads revocation list → Disables if revoked
```

**Response Example:**
```json
{
  "revoked": [
    "LIC-2024-ABCD",
    "LIC-2024-EFGH"
  ],
  "updated_at": "2024-01-15T12:00:00Z"
}
```

---

### 3. Verify License (Semi-Public)
**Endpoint:** `POST /api/v1/license/verify`
**Authentication:** None (but rate-limited by IP)
**Purpose:** Online verification of license validity

**Why Semi-Public?** Applications with existing licenses need to verify them without API keys.

**Responsibility:**
- Validates license signature
- Checks expiration date
- Checks revocation status
- Returns validity status

**Request:**
```json
{
  "license": "base64_encoded_license_data"
}
```

**Response:**
```json
{
  "valid": true,
  "license_id": "LIC-2024-ABCD",
  "expires_at": "2024-02-01T00:00:00Z",
  "status": "active"
}
```

**Use Case:**
```
User imports license → Application verifies online → Confirms validity → Activates features
```

---

### 4. Request Extension (Customer Endpoint)
**Endpoint:** `POST /api/v1/license/request-extension`
**Authentication:** None (validates via license ID + email)
**Purpose:** Allows customers to request license extensions

**Why Public?** Customers don't have accounts, they authenticate via license+email combination.

**Responsibility:**
- Validates license belongs to email
- Creates extension request for admin review
- Sends confirmation to customer

**Request:**
```json
{
  "license_id": "LIC-2024-ABCD",
  "email": "user@company.com",
  "requested_months": 3,
  "reason": "Need more time for evaluation"
}
```

**Use Case:**
```
License expiring → Customer clicks "Request Extension" → Fills form → Admin gets notified
```

---

## 🔐 APPLICATION ENDPOINTS (API Key Required)

These endpoints are called by applications (not users) and require an API key that's embedded in the application.

### 5. Request License
**Endpoint:** `POST /api/v1/license/request`
**Authentication:** API Key (X-API-Key header)
**Purpose:** Application requests a trial license for a user

**Why API Key?** Prevents spam and tracks which application is requesting licenses.

**Responsibility:**
- Validates company email (blocks gmail.com, etc.)
- Creates 30-day trial license
- Sends license via email to user
- Tracks request source via API key

**Request:**
```json
{
  "email": "user@company.com",
  "company_name": "ACME Corp",
  "user_name": "John Doe",
  "role": "DevOps Engineer",
  "purpose": "Production monitoring",
  "product": "maestro-monitor",
  "order_number": "ORD-123"  // optional
}
```

**Security Features:**
- Rate limited per API key (60 req/min default)
- Email domain validation
- Duplicate request detection

**Use Case:**
```
User in app → Clicks "Get Trial License" → App calls this endpoint → License emailed to user
```

---

## 🔑 AUTHENTICATION ENDPOINTS

### 6. Admin Login
**Endpoint:** `POST /api/v1/auth/login`
**Authentication:** None (this IS the authentication)
**Purpose:** Authenticates administrators and returns JWT token

**Responsibility:**
- Validates email/password
- Checks admin is active
- Returns JWT token for 8 hours
- Updates last login timestamp

**Request:**
```json
{
  "email": "admin@maestrohub.com",
  "password": "SecurePassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_at": "2024-01-15T20:00:00Z",
  "user": {
    "id": "admin_001",
    "email": "admin@maestrohub.com",
    "name": "John Admin",
    "role": "admin"
  }
}
```

**Security:**
- Password bcrypt hashed
- Failed attempts tracked
- Token expires in 8 hours

---

## 👨‍💼 ADMIN ENDPOINTS (JWT Required)

All these endpoints require `Authorization: Bearer <JWT_TOKEN>` header.

### 7. List All Licenses
**Endpoint:** `GET /api/v1/admin/licenses`
**Authentication:** JWT (Admin role)
**Purpose:** View all licenses in the system

**Responsibility:**
- Returns paginated license list
- Supports filtering by status, product, date range
- Includes customer information
- Shows license features and expiration

**Query Parameters:**
- `?page=1&limit=20` - Pagination
- `?status=active` - Filter by status
- `?product=maestro-monitor` - Filter by product
- `?expiring_days=7` - Show expiring soon

**Use Case:**
```
Admin dashboard → View all licenses → Filter expiring → Take action
```

---

### 8. Get License Details
**Endpoint:** `GET /api/v1/admin/licenses/:id`
**Authentication:** JWT (Admin role)
**Purpose:** View detailed information about specific license

**Responsibility:**
- Returns complete license data
- Shows customer history
- Includes audit trail
- Lists all events (created, extended, etc.)

**Response Includes:**
- License details
- Customer information
- Feature configuration
- Event history
- Signature information

---

### 9. Extend License
**Endpoint:** `POST /api/v1/admin/licenses/extend/:id`
**Authentication:** JWT (Admin role)
**Purpose:** Manually extend a license duration

**Responsibility:**
- Extends license by specified months
- Generates new signature
- Sends updated license to customer
- Creates audit log entry

**Request:**
```json
{
  "months": 6
}
```

**Use Case:**
```
Customer calls → Admin extends manually → New license emailed
```

---

### 10. Revoke License
**Endpoint:** `POST /api/v1/admin/licenses/revoke/:id`
**Authentication:** JWT (Admin role)
**Purpose:** Revoke a license (disable it immediately)

**Responsibility:**
- Marks license as revoked
- Adds to revocation list
- Sends notification to customer
- Creates audit log with reason

**Request:**
```json
{
  "reason": "Violation of terms of service"
}
```

**Impact:**
- License immediately invalid
- Appears in `/api/v1/revocations` list
- Application stops working on next check

---

### 11. List Extension Requests
**Endpoint:** `GET /api/v1/admin/extension-requests`
**Authentication:** JWT (Admin role)
**Purpose:** View all extension requests from customers

**Responsibility:**
- Shows pending/approved/rejected requests
- Includes customer information
- Shows current license expiry
- Prioritizes by urgency

**Query Parameters:**
- `?status=pending` - Filter by status
- `?sort=expiry` - Sort by license expiry date

**Dashboard Widget:**
```
⚠️ 5 Pending Extension Requests
  → 2 expiring within 7 days (urgent)
  → 3 expiring within 30 days
```

---

### 12. Get Extension Request Details
**Endpoint:** `GET /api/v1/admin/extension-requests/:id`
**Authentication:** JWT (Admin role)
**Purpose:** View specific extension request details

**Responsibility:**
- Shows complete request information
- Includes customer history
- Shows previous extensions
- Provides context for decision

---

### 13. Approve Extension Request
**Endpoint:** `POST /api/v1/admin/extension-requests/:id/approve`
**Authentication:** JWT (Admin role)
**Purpose:** Approve customer's extension request

**Responsibility:**
- Approves extension request
- Extends the license
- Generates new signed license
- Emails updated license to customer
- Records who approved and when

**Request:**
```json
{
  "approved_months": 3,  // Can differ from requested
  "notes": "Approved for continued POC"
}
```

**Workflow:**
```
Review request → Approve (maybe partial) → License extended → Customer notified
```

---

### 14. Reject Extension Request
**Endpoint:** `POST /api/v1/admin/extension-requests/:id/reject`
**Authentication:** JWT (Admin role)
**Purpose:** Reject customer's extension request

**Responsibility:**
- Marks request as rejected
- Records rejection reason
- Notifies customer with reason
- Suggests next steps

**Request:**
```json
{
  "notes": "Please contact sales for commercial license"
}
```

---

### 15. Create API Key
**Endpoint:** `POST /api/v1/admin/api-keys`
**Authentication:** JWT (Admin role)
**Purpose:** Create new API key for applications

**Responsibility:**
- Generates secure API key
- Sets rate limits
- Returns key ONLY ONCE
- Tracks who created it

**Request:**
```json
{
  "app_name": "Production App v2",
  "rate_limit": 100,  // requests per minute
  "notes": "Replacement for compromised key"
}
```

**Response:**
```json
{
  "api_key": "mhub_sk_live_abcd1234...",  // SAVE THIS!
  "app_id": "app_002",
  "warning": "Save this key securely. You won't see it again!"
}
```

---

### 16. List API Keys
**Endpoint:** `GET /api/v1/admin/api-keys`
**Authentication:** JWT (Admin role)
**Purpose:** View all API keys

**Responsibility:**
- Shows all API keys (masked)
- Display usage statistics
- Shows last used time
- Indicates active/revoked status

**Response:**
```json
{
  "keys": [
    {
      "app_id": "app_001",
      "app_name": "Production App",
      "key_prefix": "mhub_sk_live_abc...",  // Masked
      "rate_limit": 60,
      "active": true,
      "last_used": "2024-01-15T14:00:00Z",
      "request_count_today": 245
    }
  ]
}
```

---

### 17. Revoke API Key
**Endpoint:** `DELETE /api/v1/admin/api-keys/:id`
**Authentication:** JWT (Admin role)
**Purpose:** Revoke an API key

**Responsibility:**
- Deactivates API key immediately
- Applications using it will fail
- Cannot be reversed
- Logs who revoked and when

**Use Case:**
```
Key compromised → Revoke immediately → Create new key → Update application
```

---

### 18. Create Admin User
**Endpoint:** `POST /api/v1/admin/users`
**Authentication:** JWT (Admin role)
**Purpose:** Create new admin user

**Responsibility:**
- Creates new admin account
- Hashes password securely
- Sets role (admin/viewer)
- Sends welcome email (optional)

**Request:**
```json
{
  "email": "newadmin@maestrohub.com",
  "name": "Jane Admin",
  "password": "SecurePass123",
  "role": "admin"  // or "viewer" for read-only
}
```

---

## 🏥 HEALTH & MONITORING ENDPOINTS

### 19. Health Check
**Endpoint:** `GET /healthz`
**Authentication:** None
**Purpose:** Basic health check for load balancers

**Responsibility:**
- Returns 200 if server is running
- Used by Kubernetes/Docker health checks
- Minimal processing

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

---

### 20. Readiness Check
**Endpoint:** `GET /readyz`
**Authentication:** None
**Purpose:** Checks if server is ready to handle requests

**Responsibility:**
- Checks database connection
- Verifies email service
- Confirms signing keys loaded
- Used for deployment verification

**Response:**
```json
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "email": "ok",
    "signing_keys": "ok"
  }
}
```

---

### 21. Metrics
**Endpoint:** `GET /metrics`
**Authentication:** None (but should be restricted by network)
**Purpose:** Prometheus-compatible metrics

**Responsibility:**
- Exports application metrics
- Used by monitoring systems
- Tracks request counts, errors, latency

**Output Format:** Prometheus text format
```
# HELP license_requests_total Total license requests
# TYPE license_requests_total counter
license_requests_total 1234

# HELP api_request_duration_seconds API request latency
# TYPE api_request_duration_seconds histogram
api_request_duration_seconds_bucket{le="0.1"} 100
```

---

## 🔒 Security Matrix

| Endpoint Category | Authentication | Rate Limiting | Purpose |
|------------------|---------------|---------------|---------|
| Public | None | Per IP (60/min) | Verification & Info |
| Application | API Key | Per Key (configurable) | License Creation |
| Authentication | None | Per IP (10/min) | Get JWT Token |
| Admin | JWT Token | Per User (100/min) | Management |
| Health | None | None | Monitoring |

---

## 📊 Typical Usage Flow

### New Customer Journey:
1. **Application** → `POST /api/v1/license/request` (Create trial)
2. **Customer** → Receives license via email
3. **Application** → `POST /api/v1/license/verify` (Verify license)
4. **Application** → `GET /.well-known/licensing-public-key` (Cache key)
5. **Application** → `GET /api/v1/revocations` (Periodic check)

### Admin Daily Tasks:
1. **Admin** → `POST /api/v1/auth/login` (Start session)
2. **Admin** → `GET /api/v1/admin/extension-requests?status=pending` (Check requests)
3. **Admin** → `POST /api/v1/admin/extension-requests/:id/approve` (Approve)
4. **Admin** → `GET /api/v1/admin/licenses?expiring_days=7` (Monitor)

### Security Incident:
1. **Admin** → `DELETE /api/v1/admin/api-keys/:id` (Revoke compromised key)
2. **Admin** → `POST /api/v1/admin/api-keys` (Create new key)
3. **Admin** → `POST /api/v1/admin/licenses/revoke/:id` (Revoke bad license)

---

## 🎯 Key Design Principles

1. **Minimal Authentication**: Public endpoints where security isn't compromised
2. **Defense in Depth**: Multiple layers (API key + rate limit + validation)
3. **Audit Everything**: Admin actions are logged
4. **Fail Secure**: Errors default to denying access
5. **Separation of Concerns**: Application vs Admin endpoints
6. **Offline Capability**: Critical verification works without server

This architecture ensures the license server is secure, scalable, and maintainable while providing a great experience for both administrators and end users.