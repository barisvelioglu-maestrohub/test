# MaestroHUB License Server - REST API Documentation

## Base Configuration

### Server Information
```
Base URL: https://license.maestrohub.com
API Version: v1
Content-Type: application/json
```

### Authentication Types

| Type | Method | Usage |
|------|--------|-------|
| **None** | - | Public endpoints |
| **API Key** | `X-API-Key: mhub_sk_live_xxxxx` | Application endpoints |
| **JWT Bearer** | `Authorization: Bearer <token>` | Admin endpoints |

### Common Response Codes

| Code | Meaning | Action Required |
|------|---------|----------------|
| 200 | Success | None |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Check request format |
| 401 | Unauthorized | Check authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limited, wait and retry |
| 500 | Server Error | Contact support |

### Error Response Format
```json
{
  "error": "Description of the error",
  "code": 400,
  "details": {} // Optional additional information
}
```

---

## 1. Authentication

### 1.1 Admin Login

Authenticate as an administrator to receive a JWT token for subsequent requests.

```http
POST /api/v1/auth/login
Content-Type: application/json
```

#### Request Body
```json
{
  "email": "admin@maestrohub.com",
  "password": "SecurePassword123"
}
```

#### Success Response (200 OK)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2024-01-15T20:00:00Z",
  "user": {
    "id": "admin_001",
    "email": "admin@maestrohub.com",
    "name": "John Admin",
    "role": "admin"
  }
}
```

#### Error Responses
```json
// 400 Bad Request - Invalid input
{
  "error": "invalid request body",
  "code": 400
}

// 401 Unauthorized - Wrong credentials
{
  "error": "invalid credentials",
  "code": 401
}
```

#### Frontend Implementation
```javascript
async function login(email, password) {
  const response = await fetch('https://license.maestrohub.com/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password })
  });

  if (response.ok) {
    const data = await response.json();
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('token_expires', data.expires_at);
    localStorage.setItem('user_info', JSON.stringify(data.user));
    return data;
  }

  throw new Error('Login failed');
}
```

---

## 2. License Management

### 2.1 List All Licenses

Retrieve a paginated list of all licenses with optional filters.

```http
GET /api/v1/admin/licenses
Authorization: Bearer <token>
```

#### Query Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| page | integer | Page number (default: 1) | `?page=2` |
| limit | integer | Items per page (default: 20, max: 100) | `?limit=50` |
| status | string | Filter by status | `?status=active` |
| product | string | Filter by product | `?product=maestro-monitor` |
| search | string | Search in email/company | `?search=acme` |
| expiring_days | integer | Licenses expiring within X days | `?expiring_days=7` |
| sort | string | Sort field | `?sort=created_at` |
| order | string | Sort order (asc/desc) | `?order=desc` |

#### Success Response (200 OK)
```json
{
  "licenses": [
    {
      "license_id": "LIC-2024-ABCD-1234",
      "customer_id": "CUST-1234",
      "email": "john.doe@acmecorp.com",
      "company": "ACME Corporation",
      "product": "maestro-monitor",
      "status": "active",
      "valid_from": "2024-01-01T00:00:00Z",
      "valid_until": "2024-01-31T23:59:59Z",
      "lifetime": false,
      "seats": 1,
      "features": {
        "dashboards": true,
        "alerts": false,
        "reports_tier": "basic",
        "max_devices": 100,
        "api_access": true,
        "custom_branding": false
      },
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "days_until_expiry": 16,
      "usage_stats": {
        "last_verified": "2024-01-15T10:00:00Z",
        "verification_count": 45
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  },
  "summary": {
    "total_active": 120,
    "total_expired": 30,
    "total_revoked": 6,
    "expiring_soon": 12
  }
}
```

#### Frontend Implementation
```javascript
async function fetchLicenses(filters = {}) {
  const params = new URLSearchParams({
    page: filters.page || 1,
    limit: filters.limit || 20,
    ...filters
  });

  const response = await fetch(`${API_BASE}/api/v1/admin/licenses?${params}`, {
    headers: {
      'Authorization': `Bearer ${getToken()}`
    }
  });

  return response.json();
}
```

### 2.2 Get License Details

Retrieve detailed information about a specific license.

```http
GET /api/v1/admin/licenses/{license_id}
Authorization: Bearer <token>
```

#### URL Parameters
- `license_id` (string, required): The license ID

#### Success Response (200 OK)
```json
{
  "license": {
    "license_id": "LIC-2024-ABCD-1234",
    "customer": {
      "id": "CUST-1234",
      "email": "john.doe@acmecorp.com",
      "name": "John Doe",
      "company": "ACME Corporation",
      "created_at": "2023-06-01T00:00:00Z",
      "total_licenses": 3,
      "notes": "Enterprise customer"
    },
    "product": "maestro-monitor",
    "status": "active",
    "valid_from": "2024-01-01T00:00:00Z",
    "valid_until": "2024-01-31T23:59:59Z",
    "lifetime": false,
    "seats": 1,
    "features": {
      "dashboards": true,
      "alerts": false,
      "reports_tier": "basic",
      "max_devices": 100
    },
    "signature": "Ed25519:base64signature...",
    "key_id": "kid_2024_01",
    "schema_version": 1,
    "notes": "Trial license for POC",
    "events": [
      {
        "type": "created",
        "timestamp": "2024-01-01T00:00:00Z",
        "actor": "system",
        "details": "Trial license created via API"
      },
      {
        "type": "verified",
        "timestamp": "2024-01-15T10:00:00Z",
        "actor": "application",
        "details": "Online verification"
      }
    ],
    "extension_history": [],
    "metadata": {
      "order_number": "ORD-123",
      "requested_by": "john.doe@acmecorp.com",
      "purpose": "Production monitoring"
    }
  }
}
```

#### Error Response
```json
// 404 Not Found
{
  "error": "license not found",
  "code": 404
}
```

### 2.3 Extend License

Manually extend a license duration by specified months.

```http
POST /api/v1/admin/licenses/extend/{license_id}
Authorization: Bearer <token>
Content-Type: application/json
```

#### URL Parameters
- `license_id` (string, required): The license ID to extend

#### Request Body
```json
{
  "months": 6,
  "notes": "Extended for phase 2 of project"
}
```

#### Success Response (200 OK)
```json
{
  "message": "license extended successfully",
  "license_id": "LIC-2024-ABCD-1234",
  "old_expiry": "2024-01-31T23:59:59Z",
  "new_expiry": "2024-07-31T23:59:59Z",
  "extended_by": "admin@maestrohub.com",
  "extended_at": "2024-01-15T12:00:00Z"
}
```

#### Error Responses
```json
// 404 Not Found
{
  "error": "license not found",
  "code": 404
}

// 400 Bad Request - Invalid months
{
  "error": "months must be between 1 and 12",
  "code": 400
}

// 400 Bad Request - License revoked
{
  "error": "cannot extend revoked license",
  "code": 400
}
```

### 2.4 Revoke License

Permanently revoke a license, making it immediately invalid.

```http
POST /api/v1/admin/licenses/revoke/{license_id}
Authorization: Bearer <token>
Content-Type: application/json
```

#### URL Parameters
- `license_id` (string, required): The license ID to revoke

#### Request Body
```json
{
  "reason": "Terms of service violation - unauthorized redistribution"
}
```

#### Success Response (200 OK)
```json
{
  "message": "license revoked successfully",
  "license_id": "LIC-2024-ABCD-1234",
  "revoked_at": "2024-01-15T12:00:00Z",
  "revoked_by": "admin@maestrohub.com"
}
```

#### Error Responses
```json
// 404 Not Found
{
  "error": "license not found",
  "code": 404
}

// 400 Bad Request - Already revoked
{
  "error": "license already revoked",
  "code": 400
}
```

---

## 3. Extension Request Management

### 3.1 List Extension Requests

Get all license extension requests with filtering options.

```http
GET /api/v1/admin/extension-requests
Authorization: Bearer <token>
```

#### Query Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| status | string | Filter by status (pending/approved/rejected) | `?status=pending` |
| page | integer | Page number | `?page=1` |
| limit | integer | Items per page | `?limit=20` |
| sort | string | Sort by field | `?sort=requested_at` |

#### Success Response (200 OK)
```json
{
  "requests": [
    {
      "id": "EXT-REQ-2024-001",
      "license_id": "LIC-2024-ABCD-1234",
      "customer": {
        "id": "CUST-1234",
        "email": "john.doe@acmecorp.com",
        "company": "ACME Corporation",
        "name": "John Doe"
      },
      "product": "maestro-monitor",
      "current_expiry": "2024-01-31T23:59:59Z",
      "days_until_expiry": 16,
      "requested_months": 3,
      "reason": "Need more time to complete POC and get budget approval",
      "status": "pending",
      "priority": "high", // high if expiring within 7 days
      "requested_by": "john.doe@acmecorp.com",
      "requested_at": "2024-01-15T10:00:00Z",
      "reviewed_by": null,
      "reviewed_at": null,
      "review_notes": null,
      "approved_months": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "total_pages": 1
  },
  "summary": {
    "pending": 3,
    "approved_today": 2,
    "rejected_today": 1,
    "urgent": 2 // expiring within 7 days
  }
}
```

### 3.2 Get Extension Request Details

Get detailed information about a specific extension request.

```http
GET /api/v1/admin/extension-requests/{request_id}
Authorization: Bearer <token>
```

#### URL Parameters
- `request_id` (string, required): Extension request ID

#### Success Response (200 OK)
```json
{
  "request": {
    "id": "EXT-REQ-2024-001",
    "license": {
      "license_id": "LIC-2024-ABCD-1234",
      "product": "maestro-monitor",
      "valid_from": "2024-01-01T00:00:00Z",
      "valid_until": "2024-01-31T23:59:59Z",
      "features": {
        "dashboards": true,
        "alerts": false,
        "reports_tier": "basic"
      }
    },
    "customer": {
      "id": "CUST-1234",
      "email": "john.doe@acmecorp.com",
      "name": "John Doe",
      "company": "ACME Corporation",
      "customer_since": "2023-06-01T00:00:00Z",
      "total_licenses": 3,
      "previous_extensions": [
        {
          "date": "2023-10-15T00:00:00Z",
          "months": 2,
          "approved_by": "admin@maestrohub.com"
        }
      ]
    },
    "requested_months": 3,
    "reason": "Need more time to complete POC and get budget approval",
    "status": "pending",
    "requested_at": "2024-01-15T10:00:00Z",
    "history": [
      {
        "action": "requested",
        "timestamp": "2024-01-15T10:00:00Z",
        "actor": "john.doe@acmecorp.com"
      }
    ]
  }
}
```

### 3.3 Approve Extension Request

Approve a customer's license extension request.

```http
POST /api/v1/admin/extension-requests/{request_id}/approve
Authorization: Bearer <token>
Content-Type: application/json
```

#### URL Parameters
- `request_id` (string, required): Extension request ID

#### Request Body
```json
{
  "approved_months": 2,
  "notes": "Approved 2 months for POC completion. Contact sales for commercial license."
}
```

#### Success Response (200 OK)
```json
{
  "message": "extension request approved",
  "request_id": "EXT-REQ-2024-001",
  "license_id": "LIC-2024-ABCD-1234",
  "old_expiry": "2024-01-31T23:59:59Z",
  "new_expiry": "2024-03-31T23:59:59Z",
  "approved_by": "admin@maestrohub.com",
  "approved_at": "2024-01-15T12:00:00Z",
  "customer_notified": true
}
```

#### Error Responses
```json
// 404 Not Found
{
  "error": "extension request not found",
  "code": 404
}

// 400 Bad Request - Already processed
{
  "error": "request already processed",
  "code": 400,
  "details": {
    "status": "approved",
    "processed_at": "2024-01-14T10:00:00Z"
  }
}
```

### 3.4 Reject Extension Request

Reject a customer's license extension request.

```http
POST /api/v1/admin/extension-requests/{request_id}/reject
Authorization: Bearer <token>
Content-Type: application/json
```

#### URL Parameters
- `request_id` (string, required): Extension request ID

#### Request Body
```json
{
  "notes": "Trial period cannot be extended beyond 30 days. Please contact sales@maestrohub.com for a commercial license."
}
```

#### Success Response (200 OK)
```json
{
  "message": "extension request rejected",
  "request_id": "EXT-REQ-2024-001",
  "rejected_by": "admin@maestrohub.com",
  "rejected_at": "2024-01-15T12:00:00Z",
  "customer_notified": true
}
```

---

## 4. API Key Management

### 4.1 Create API Key

Generate a new API key for application authentication.

```http
POST /api/v1/admin/api-keys
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body
```json
{
  "app_name": "Production Application v2.0",
  "rate_limit": 100,
  "notes": "Replacement for deprecated v1 key"
}
```

#### Success Response (201 Created)
```json
{
  "api_key": "mhub_sk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
  "app_id": "app_prod_002",
  "app_name": "Production Application v2.0",
  "rate_limit": 100,
  "created_at": "2024-01-15T12:00:00Z",
  "created_by": "admin@maestrohub.com",
  "warning": "⚠️ Save this API key securely. You won't be able to see it again!"
}
```

#### Error Response
```json
// 400 Bad Request - Invalid rate limit
{
  "error": "rate_limit must be between 1 and 10000",
  "code": 400
}
```

### 4.2 List API Keys

Get all API keys with usage statistics.

```http
GET /api/v1/admin/api-keys
Authorization: Bearer <token>
```

#### Query Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| active | boolean | Filter by active status | `?active=true` |
| page | integer | Page number | `?page=1` |
| limit | integer | Items per page | `?limit=20` |

#### Success Response (200 OK)
```json
{
  "keys": [
    {
      "app_id": "app_prod_001",
      "app_name": "Production Application",
      "key_prefix": "mhub_sk_live_a1b2...",
      "rate_limit": 60,
      "active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "created_by": "admin@maestrohub.com",
      "last_used": "2024-01-15T14:30:00Z",
      "notes": "Main production API key",
      "usage_stats": {
        "requests_today": 245,
        "requests_this_month": 5420,
        "avg_daily_requests": 180,
        "last_request_ip": "192.168.1.100"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3
  },
  "summary": {
    "total_active": 2,
    "total_revoked": 1,
    "total_requests_today": 520
  }
}
```

### 4.3 Revoke API Key

Permanently revoke an API key.

```http
DELETE /api/v1/admin/api-keys/{app_id}
Authorization: Bearer <token>
```

#### URL Parameters
- `app_id` (string, required): Application ID

#### Success Response (200 OK)
```json
{
  "message": "API key revoked successfully",
  "app_id": "app_prod_001",
  "revoked_by": "admin@maestrohub.com",
  "revoked_at": "2024-01-15T12:00:00Z"
}
```

#### Error Response
```json
// 404 Not Found
{
  "error": "API key not found",
  "code": 404
}
```

---

## 5. Admin User Management

### 5.1 Create Admin User

Create a new administrator account.

```http
POST /api/v1/admin/users
Authorization: Bearer <token>
Content-Type: application/json
```

#### Request Body
```json
{
  "email": "newadmin@maestrohub.com",
  "name": "Jane Smith",
  "password": "SecurePassword123!",
  "role": "admin"
}
```

#### Role Options
- `admin` - Full access to all operations
- `viewer` - Read-only access

#### Success Response (201 Created)
```json
{
  "id": "admin_002",
  "email": "newadmin@maestrohub.com",
  "name": "Jane Smith",
  "role": "admin",
  "created_at": "2024-01-15T12:00:00Z",
  "created_by": "admin@maestrohub.com",
  "message": "admin user created successfully"
}
```

#### Error Responses
```json
// 409 Conflict - Email exists
{
  "error": "email already exists",
  "code": 409
}

// 400 Bad Request - Weak password
{
  "error": "password must be at least 8 characters",
  "code": 400
}
```

---

## 6. Public Endpoints (No Authentication)

### 6.1 Request License (API Key Required)

Applications use this endpoint to request trial licenses for users.

```http
POST /api/v1/license/request
X-API-Key: mhub_sk_live_xxxxx
Content-Type: application/json
```

#### Request Headers
- `X-API-Key` (string, required): Application API key

#### Request Body
```json
{
  "email": "john.doe@acmecorp.com",
  "company_name": "ACME Corporation",
  "user_name": "John Doe",
  "role": "DevOps Engineer",
  "purpose": "Production monitoring and alerting",
  "product": "maestro-monitor",
  "order_number": "ORD-2024-123"
}
```

#### Success Response (201 Created)
```json
{
  "message": "license created and sent to your email",
  "status": "success",
  "license_id": "LIC-2024-ABCD-1234",
  "email_sent_to": "john.doe@acmecorp.com"
}
```

#### Error Responses
```json
// 400 Bad Request - Public email domain
{
  "error": "please use a company email address, public email domains are not allowed",
  "code": 400,
  "details": {
    "blocked_domain": "gmail.com"
  }
}

// 200 OK - Existing license resent
{
  "message": "existing license sent to your email",
  "status": "license_resent",
  "license_id": "LIC-2024-EXISTING"
}

// 401 Unauthorized - Invalid API key
{
  "error": "API key required",
  "code": 401
}

// 429 Too Many Requests
{
  "error": "rate limit exceeded",
  "code": 429,
  "details": {
    "retry_after": 60
  }
}
```

### 6.2 Verify License

Verify a license signature and validity.

```http
POST /api/v1/license/verify
Content-Type: application/json
```

#### Request Body
```json
{
  "license": "eyJsaWNlbnNlX2lkIjoiTElDLTIwMjQtQUJDRC0xMjM0IiwiY3VzdG9tZXJfaWQiOiJDVVNULTEyMzQiLC4uLg=="
}
```

#### Success Response (200 OK)
```json
{
  "valid": true,
  "license_id": "LIC-2024-ABCD-1234",
  "customer_id": "CUST-1234",
  "product": "maestro-monitor",
  "expires_at": "2024-01-31T23:59:59Z",
  "status": "active",
  "days_remaining": 16
}
```

#### Error Response
```json
// 200 OK - Invalid license
{
  "valid": false,
  "reason": "expired",
  "expired_at": "2024-01-01T00:00:00Z"
}
```

### 6.3 Request Extension

Customers request license extension without authentication.

```http
POST /api/v1/license/request-extension
Content-Type: application/json
```

#### Request Body
```json
{
  "license_id": "LIC-2024-ABCD-1234",
  "email": "john.doe@acmecorp.com",
  "requested_months": 3,
  "reason": "Need additional time to complete evaluation and secure budget"
}
```

#### Success Response (201 Created)
```json
{
  "message": "extension request submitted",
  "request_id": "EXT-REQ-2024-001",
  "status": "pending",
  "notification": "You will receive an email once your request is reviewed"
}
```

#### Error Responses
```json
// 403 Forbidden - Email doesn't match
{
  "error": "license does not belong to this email",
  "code": 403
}

// 404 Not Found
{
  "error": "license not found",
  "code": 404
}

// 409 Conflict - Duplicate request
{
  "error": "extension request already exists",
  "code": 409,
  "details": {
    "existing_request_id": "EXT-REQ-2024-000",
    "status": "pending"
  }
}
```

### 6.4 Get Public Key

Get the public key for offline license verification.

```http
GET /.well-known/licensing-public-key
```

#### Success Response (200 OK)
```
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAGqBxJXawP6HgzkxCtiwN8bPDzFlyQFPZxVhN6XpqQTg=
-----END PUBLIC KEY-----
```

#### Response Headers
```
Content-Type: application/x-pem-file
Cache-Control: public, max-age=86400
```

### 6.5 Get Revocations

Get list of revoked license IDs.

```http
GET /api/v1/revocations
```

#### Success Response (200 OK)
```json
{
  "revoked": [
    "LIC-2024-ABCD-1234",
    "LIC-2024-EFGH-5678",
    "LIC-2023-IJKL-9012"
  ],
  "updated_at": "2024-01-15T12:00:00Z",
  "next_update": "2024-01-15T13:00:00Z"
}
```

---

## 7. Health & Monitoring

### 7.1 Health Check

Basic health check for load balancers.

```http
GET /healthz
```

#### Success Response (200 OK)
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-15T12:00:00Z"
}
```

### 7.2 Readiness Check

Comprehensive readiness check including dependencies.

```http
GET /readyz
```

#### Success Response (200 OK)
```json
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "email": "ok",
    "signing_keys": "ok",
    "rate_limiter": "ok"
  },
  "timestamp": "2024-01-15T12:00:00Z"
}
```

#### Error Response (503 Service Unavailable)
```json
{
  "status": "not ready",
  "checks": {
    "database": "ok",
    "email": "error: SMTP connection failed",
    "signing_keys": "ok",
    "rate_limiter": "ok"
  }
}
```

### 7.3 Metrics

Prometheus-compatible metrics endpoint.

```http
GET /metrics
Authorization: Bearer <token>
```

#### Response (200 OK)
```
# HELP license_requests_total Total number of license requests
# TYPE license_requests_total counter
license_requests_total{status="success"} 1234
license_requests_total{status="failed"} 56

# HELP license_verifications_total Total number of license verifications
# TYPE license_verifications_total counter
license_verifications_total{type="online"} 5678
license_verifications_total{type="offline"} 910

# HELP extension_requests_total Total extension requests
# TYPE extension_requests_total counter
extension_requests_total{status="pending"} 5
extension_requests_total{status="approved"} 45
extension_requests_total{status="rejected"} 12

# HELP api_request_duration_seconds API request latency
# TYPE api_request_duration_seconds histogram
api_request_duration_seconds_bucket{endpoint="/api/v1/licenses",le="0.1"} 100
api_request_duration_seconds_bucket{endpoint="/api/v1/licenses",le="0.5"} 150
api_request_duration_seconds_bucket{endpoint="/api/v1/licenses",le="1"} 175
```

---

## Frontend Implementation Guide

### 1. Authentication Setup

```javascript
// auth.js
class AuthService {
  constructor() {
    this.baseURL = 'https://license.maestrohub.com';
    this.token = localStorage.getItem('auth_token');
  }

  async login(email, password) {
    const response = await fetch(`${this.baseURL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    this.token = data.token;
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('token_expires', data.expires_at);
    localStorage.setItem('user', JSON.stringify(data.user));

    return data;
  }

  logout() {
    this.token = null;
    localStorage.clear();
    window.location.href = '/login';
  }

  isAuthenticated() {
    const expires = localStorage.getItem('token_expires');
    return this.token && expires && new Date(expires) > new Date();
  }

  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }
}
```

### 2. API Client

```javascript
// api.js
class LicenseAPI {
  constructor(authService) {
    this.auth = authService;
    this.baseURL = 'https://license.maestrohub.com/api/v1';
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        ...this.auth.getAuthHeaders(),
        ...options.headers
      }
    });

    if (response.status === 401) {
      this.auth.logout();
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // License methods
  async getLicenses(filters = {}) {
    const params = new URLSearchParams(filters);
    return this.request(`/admin/licenses?${params}`);
  }

  async getLicense(id) {
    return this.request(`/admin/licenses/${id}`);
  }

  async extendLicense(id, months, notes) {
    return this.request(`/admin/licenses/extend/${id}`, {
      method: 'POST',
      body: JSON.stringify({ months, notes })
    });
  }

  async revokeLicense(id, reason) {
    return this.request(`/admin/licenses/revoke/${id}`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // Extension requests
  async getExtensionRequests(status = '') {
    const params = status ? `?status=${status}` : '';
    return this.request(`/admin/extension-requests${params}`);
  }

  async approveExtension(id, approvedMonths, notes) {
    return this.request(`/admin/extension-requests/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approved_months: approvedMonths, notes })
    });
  }

  async rejectExtension(id, notes) {
    return this.request(`/admin/extension-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
  }

  // API Keys
  async createAPIKey(appName, rateLimit, notes) {
    return this.request('/admin/api-keys', {
      method: 'POST',
      body: JSON.stringify({ app_name: appName, rate_limit: rateLimit, notes })
    });
  }

  async getAPIKeys() {
    return this.request('/admin/api-keys');
  }

  async revokeAPIKey(appId) {
    return this.request(`/admin/api-keys/${appId}`, {
      method: 'DELETE'
    });
  }

  // Admin users
  async createAdmin(email, name, password, role) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email, name, password, role })
    });
  }
}
```

### 3. React Component Example

```jsx
// LicenseTable.jsx
import React, { useState, useEffect } from 'react';
import { LicenseAPI } from './api';

function LicenseTable() {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    search: ''
  });

  const api = new LicenseAPI(authService);

  useEffect(() => {
    fetchLicenses();
  }, [filters]);

  const fetchLicenses = async () => {
    try {
      setLoading(true);
      const data = await api.getLicenses(filters);
      setLicenses(data.licenses);
    } catch (error) {
      console.error('Failed to fetch licenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async (licenseId) => {
    const months = prompt('Extend for how many months? (1-12)');
    if (months) {
      try {
        await api.extendLicense(licenseId, parseInt(months), 'Manual extension');
        await fetchLicenses(); // Refresh
        alert('License extended successfully');
      } catch (error) {
        alert('Failed to extend license: ' + error.message);
      }
    }
  };

  const handleRevoke = async (licenseId) => {
    const reason = prompt('Reason for revocation:');
    if (reason && confirm('Are you sure you want to revoke this license?')) {
      try {
        await api.revokeLicense(licenseId, reason);
        await fetchLicenses(); // Refresh
        alert('License revoked successfully');
      } catch (error) {
        alert('Failed to revoke license: ' + error.message);
      }
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>License Management</h2>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search..."
          value={filters.search}
          onChange={(e) => setFilters({...filters, search: e.target.value})}
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value})}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th>License ID</th>
            <th>Company</th>
            <th>Email</th>
            <th>Product</th>
            <th>Status</th>
            <th>Expires</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {licenses.map(license => (
            <tr key={license.license_id}>
              <td>{license.license_id}</td>
              <td>{license.company}</td>
              <td>{license.email}</td>
              <td>{license.product}</td>
              <td>
                <span className={`badge badge-${license.status}`}>
                  {license.status}
                </span>
              </td>
              <td>{new Date(license.valid_until).toLocaleDateString()}</td>
              <td>
                <button onClick={() => handleExtend(license.license_id)}>
                  Extend
                </button>
                <button onClick={() => handleRevoke(license.license_id)}>
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="pagination">
        <button
          disabled={filters.page === 1}
          onClick={() => setFilters({...filters, page: filters.page - 1})}
        >
          Previous
        </button>
        <span>Page {filters.page}</span>
        <button
          onClick={() => setFilters({...filters, page: filters.page + 1})}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

### 4. Error Handling

```javascript
// errorHandler.js
class ErrorHandler {
  static handle(error, response) {
    switch (response.status) {
      case 400:
        return { type: 'validation', message: error.error };
      case 401:
        return { type: 'auth', message: 'Please login again' };
      case 403:
        return { type: 'permission', message: 'Access denied' };
      case 404:
        return { type: 'notfound', message: 'Resource not found' };
      case 429:
        return { type: 'ratelimit', message: 'Too many requests, please wait' };
      case 500:
        return { type: 'server', message: 'Server error, please try again' };
      default:
        return { type: 'unknown', message: 'An error occurred' };
    }
  }
}
```

### 5. WebSocket for Real-time Updates (Optional)

```javascript
// websocket.js
class LicenseWebSocket {
  constructor(token) {
    this.ws = new WebSocket('wss://license.maestrohub.com/ws');
    this.token = token;
  }

  connect() {
    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({
        type: 'auth',
        token: this.token
      }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }

  handleMessage(data) {
    switch (data.type) {
      case 'new_extension_request':
        // Show notification
        this.showNotification('New extension request', data.request);
        break;
      case 'license_expired':
        // Update UI
        this.updateLicenseStatus(data.license_id, 'expired');
        break;
    }
  }
}
```

---

## Testing the API

### Postman Collection

Import this collection to test all endpoints:

```json
{
  "info": {
    "name": "MaestroHUB License Server",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseURL",
      "value": "https://license.maestrohub.com"
    },
    {
      "key": "token",
      "value": ""
    }
  ],
  "item": [
    {
      "name": "Login",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"admin@maestrohub.com\",\n  \"password\": \"password123\"\n}"
        },
        "url": "{{baseURL}}/api/v1/auth/login"
      }
    },
    {
      "name": "Get Licenses",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": "{{baseURL}}/api/v1/admin/licenses"
      }
    }
  ]
}
```

---

## Rate Limiting

| Endpoint Type | Limit | Window | Scope |
|--------------|-------|---------|-------|
| Public | 60 req | 1 minute | Per IP |
| API Key | Configurable | 1 minute | Per Key |
| Admin | 100 req | 1 minute | Per User |
| Auth | 10 req | 1 minute | Per IP |

---

## Status Codes Reference

| Code | Meaning | When Used |
|------|---------|-----------|
| 200 | OK | Successful GET, PUT, POST |
| 201 | Created | Resource created |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | No permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |
| 429 | Too Many Requests | Rate limited |
| 500 | Server Error | Internal error |
| 503 | Service Unavailable | Server not ready |

---

This comprehensive REST API documentation provides everything a frontend developer needs to build a complete UI for the MaestroHUB License Server.