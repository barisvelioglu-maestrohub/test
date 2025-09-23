# MaestroHUB License Server - UI Developer Guide

## Project Overview

You need to build a production-ready web-based admin interface for the MaestroHUB License Server. This UI will be used by administrators to manage licenses, review extension requests, manage API keys, and monitor system health. The UI should be modern, responsive, and secure.

## Technology Stack Requirements

- **Framework**: React, Vue.js, or Angular (your choice)
- **UI Library**: Material-UI, Ant Design, or Tailwind CSS recommended
- **State Management**: Redux, Vuex, or Context API
- **HTTP Client**: Axios or Fetch API
- **Authentication**: JWT token storage and management
- **Charts**: For metrics dashboard (Chart.js, D3.js, or Recharts)

## Base Configuration

```javascript
// config.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://license.maestrohub.com';
const API_VERSION = '/api/v1';

const API_ENDPOINTS = {
  // Authentication
  LOGIN: `${API_BASE_URL}${API_VERSION}/auth/login`,

  // Admin User Management
  CREATE_ADMIN: `${API_BASE_URL}${API_VERSION}/admin/users`,

  // API Key Management
  API_KEYS: `${API_BASE_URL}${API_VERSION}/admin/api-keys`,

  // License Management
  LICENSES: `${API_BASE_URL}${API_VERSION}/admin/licenses`,

  // Extension Requests
  EXTENSION_REQUESTS: `${API_BASE_URL}${API_VERSION}/admin/extension-requests`,

  // Health & Metrics
  HEALTH: `${API_BASE_URL}/healthz`,
  READY: `${API_BASE_URL}/readyz`,
  METRICS: `${API_BASE_URL}/metrics`,
};
```

## Authentication Flow

### 1. Login Page

**Purpose**: Authenticate administrators to access the dashboard

**Endpoint**: `POST /api/v1/auth/login`

**Request**:
```javascript
const login = async (email, password) => {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email,        // Required, valid email
      password: password   // Required, min 8 characters
    })
  });

  return response.json();
};
```

**Success Response (200)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expires_at": "2024-01-15T18:00:00Z",
  "user": {
    "id": "admin_abc123",
    "email": "admin@maestrohub.com",
    "name": "John Admin",
    "role": "admin"
  }
}
```

**Error Responses**:
- **400 Bad Request**: Invalid request format
  ```json
  {
    "error": "invalid request body",
    "code": 400
  }
  ```
- **401 Unauthorized**: Invalid credentials
  ```json
  {
    "error": "invalid credentials",
    "code": 401
  }
  ```

**UI Requirements**:
- Email input field with validation
- Password input field (min 8 chars)
- "Remember Me" checkbox (optional)
- Show/hide password toggle
- Loading state during authentication
- Error message display
- Redirect to dashboard on success

**Token Management**:
```javascript
// Store token securely
localStorage.setItem('auth_token', response.token);
localStorage.setItem('token_expires', response.expires_at);
localStorage.setItem('user_info', JSON.stringify(response.user));

// Add token to all subsequent requests
const authenticatedFetch = (url, options = {}) => {
  const token = localStorage.getItem('auth_token');
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
};

// Check token expiry
const isTokenValid = () => {
  const expires = localStorage.getItem('token_expires');
  return expires && new Date(expires) > new Date();
};
```

### 2. Logout

**Implementation**:
```javascript
const logout = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('token_expires');
  localStorage.removeItem('user_info');
  window.location.href = '/login';
};
```

## Main Dashboard

### Overview Page

**Components to Display**:

1. **Statistics Cards**:
   ```javascript
   const fetchStats = async () => {
     // You'll need to aggregate from different endpoints
     const licenses = await authenticatedFetch(`${API_ENDPOINTS.LICENSES}`);
     const apiKeys = await authenticatedFetch(`${API_ENDPOINTS.API_KEYS}`);
     const extensionRequests = await authenticatedFetch(`${API_ENDPOINTS.EXTENSION_REQUESTS}?status=pending`);

     return {
       totalLicenses: licenses.total,
       activeApiKeys: apiKeys.keys.filter(k => k.active).length,
       pendingExtensions: extensionRequests.total,
       // Calculate from licenses
       expiringLicenses: licenses.licenses.filter(l => {
         const daysUntil = (new Date(l.valid_until) - new Date()) / (1000 * 60 * 60 * 24);
         return daysUntil <= 7 && daysUntil > 0;
       }).length
     };
   };
   ```

2. **Quick Actions**:
   - View Pending Extension Requests (with badge count)
   - Create New API Key
   - View Expiring Licenses
   - System Health Status

## License Management

### 1. List All Licenses

**Endpoint**: `GET /api/v1/admin/licenses`

**Request**:
```javascript
const fetchLicenses = async (page = 1, limit = 20, status = '') => {
  const params = new URLSearchParams({
    page,
    limit,
    ...(status && { status })
  });

  const response = await authenticatedFetch(
    `${API_ENDPOINTS.LICENSES}?${params}`
  );

  return response.json();
};
```

**Success Response (200)**:
```json
{
  "licenses": [
    {
      "license_id": "LIC-2024-ABCD",
      "customer_id": "CUST-1234",
      "email": "john.doe@acmecorp.com",
      "company": "ACME Corp",
      "product": "maestro-monitor",
      "status": "active",
      "valid_from": "2024-01-01T00:00:00Z",
      "valid_until": "2024-01-31T00:00:00Z",
      "lifetime": false,
      "seats": 1,
      "features": {
        "dashboards": true,
        "alerts": false,
        "reports_tier": "basic",
        "max_devices": 100
      },
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 156,
  "page": 1,
  "limit": 20
}
```

**UI Components**:
- Searchable table with filters
- Status badges (active, expired, revoked)
- Sort by: created date, expiry date, company
- Filter by: status, product, expiry range
- Actions: View details, Extend, Revoke

### 2. View License Details

**Endpoint**: `GET /api/v1/admin/licenses/:id`

**Request**:
```javascript
const fetchLicenseDetails = async (licenseId) => {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.LICENSES}/${licenseId}`
  );
  return response.json();
};
```

**Success Response (200)**:
```json
{
  "license": {
    "license_id": "LIC-2024-ABCD",
    "customer": {
      "id": "CUST-1234",
      "email": "john.doe@acmecorp.com",
      "name": "John Doe",
      "company": "ACME Corp"
    },
    "product": "maestro-monitor",
    "status": "active",
    "valid_from": "2024-01-01T00:00:00Z",
    "valid_until": "2024-01-31T00:00:00Z",
    "lifetime": false,
    "seats": 1,
    "features": {
      "dashboards": true,
      "alerts": false,
      "reports_tier": "basic",
      "max_devices": 100
    },
    "signature": "Ed25519_signature_base64",
    "events": [
      {
        "type": "created",
        "timestamp": "2024-01-01T00:00:00Z",
        "actor": "system"
      },
      {
        "type": "extended",
        "timestamp": "2024-01-15T00:00:00Z",
        "actor": "admin@maestrohub.com"
      }
    ]
  }
}
```

**UI Components**:
- License information card
- Customer details section
- Features list with checkmarks
- Event timeline
- Action buttons: Extend, Revoke, Download

### 3. Extend License

**Endpoint**: `POST /api/v1/admin/licenses/extend/:id`

**Request**:
```javascript
const extendLicense = async (licenseId, months) => {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.LICENSES}/extend/${licenseId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ months })
    }
  );
  return response.json();
};
```

**Success Response (200)**:
```json
{
  "message": "license extended successfully",
  "new_expiry": "2024-03-31T00:00:00Z"
}
```

**Error Responses**:
- **404**: License not found
- **400**: Invalid months value

**UI Components**:
- Modal dialog with month selector (1-12)
- Confirmation message
- Show new expiry date

### 4. Revoke License

**Endpoint**: `POST /api/v1/admin/licenses/revoke/:id`

**Request**:
```javascript
const revokeLicense = async (licenseId, reason) => {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.LICENSES}/revoke/${licenseId}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    }
  );
  return response.json();
};
```

**Success Response (200)**:
```json
{
  "message": "license revoked successfully",
  "revoked_at": "2024-01-15T12:00:00Z"
}
```

**UI Components**:
- Confirmation modal with warning
- Reason textarea (required)
- Double confirmation ("Type REVOKE to confirm")

## Extension Request Management

### 1. List Extension Requests

**Endpoint**: `GET /api/v1/admin/extension-requests`

**Request**:
```javascript
const fetchExtensionRequests = async (status = '') => {
  const params = status ? `?status=${status}` : '';
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.EXTENSION_REQUESTS}${params}`
  );
  return response.json();
};
```

**Success Response (200)**:
```json
{
  "requests": [
    {
      "id": "EXT-REQ-001",
      "license_id": "LIC-2024-ABCD",
      "customer": {
        "id": "CUST-1234",
        "email": "john.doe@acmecorp.com",
        "company": "ACME Corp"
      },
      "requested_months": 3,
      "reason": "Need more time for POC completion",
      "status": "pending",
      "requested_by": "john.doe@acmecorp.com",
      "requested_at": "2024-01-25T10:00:00Z",
      "license_expires": "2024-01-31T00:00:00Z"
    }
  ],
  "total": 5
}
```

**UI Components**:
- Tab navigation: Pending | Approved | Rejected | All
- Request cards with:
  - Customer info
  - Current license expiry
  - Requested extension
  - Reason for extension
  - Days until expiry (highlighted if < 7)
- Actions: View Details, Approve, Reject

### 2. View Extension Request Details

**Endpoint**: `GET /api/v1/admin/extension-requests/:id`

**Request**:
```javascript
const fetchExtensionRequestDetails = async (requestId) => {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.EXTENSION_REQUESTS}/${requestId}`
  );
  return response.json();
};
```

**Success Response (200)**:
```json
{
  "id": "EXT-REQ-001",
  "license": {
    "license_id": "LIC-2024-ABCD",
    "product": "maestro-monitor",
    "valid_until": "2024-01-31T00:00:00Z",
    "features": {...}
  },
  "customer": {
    "id": "CUST-1234",
    "email": "john.doe@acmecorp.com",
    "name": "John Doe",
    "company": "ACME Corp",
    "total_licenses": 3,
    "customer_since": "2023-01-01T00:00:00Z"
  },
  "requested_months": 3,
  "reason": "Need more time for POC completion",
  "status": "pending",
  "requested_at": "2024-01-25T10:00:00Z",
  "history": []
}
```

### 3. Approve Extension Request

**Endpoint**: `POST /api/v1/admin/extension-requests/:id/approve`

**Request**:
```javascript
const approveExtension = async (requestId, approvedMonths, notes) => {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.EXTENSION_REQUESTS}/${requestId}/approve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approved_months: approvedMonths,  // Required, 1-12
        notes: notes                      // Optional
      })
    }
  );
  return response.json();
};
```

**Success Response (200)**:
```json
{
  "message": "extension request approved",
  "status": "approved",
  "new_expiry": "2024-03-31T00:00:00Z"
}
```

**Error Responses**:
- **404**: Request not found
- **400**: Invalid months or already processed

**UI Components**:
- Approval form:
  - Requested: 3 months (display only)
  - Approve for: [slider 1-12 months]
  - Admin notes: [textarea]
- Success notification
- Auto-redirect to pending list

### 4. Reject Extension Request

**Endpoint**: `POST /api/v1/admin/extension-requests/:id/reject`

**Request**:
```javascript
const rejectExtension = async (requestId, notes) => {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.EXTENSION_REQUESTS}/${requestId}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: notes  // Required, rejection reason
      })
    }
  );
  return response.json();
};
```

**Success Response (200)**:
```json
{
  "message": "extension request rejected",
  "status": "rejected"
}
```

**UI Components**:
- Rejection form:
  - Reason (required): [textarea]
  - Suggested templates:
    - "Please contact sales for commercial license"
    - "Trial period cannot be extended further"
    - "Custom reason..."

## API Key Management

### 1. List API Keys

**Endpoint**: `GET /api/v1/admin/api-keys`

**Request**:
```javascript
const fetchAPIKeys = async () => {
  const response = await authenticatedFetch(API_ENDPOINTS.API_KEYS);
  return response.json();
};
```

**Success Response (200)**:
```json
{
  "keys": [
    {
      "app_id": "app_prod_001",
      "app_name": "Production Application",
      "key_prefix": "mhub_sk_live_1234...",
      "rate_limit": 100,
      "active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "last_used": "2024-01-15T14:30:00Z",
      "created_by": "admin@maestrohub.com"
    }
  ],
  "total": 3
}
```

**UI Components**:
- Table with:
  - App name
  - Key prefix (masked)
  - Rate limit
  - Status (active/revoked)
  - Last used
  - Usage count (if available)
- Actions: View details, Revoke, Edit rate limit

### 2. Create API Key

**Endpoint**: `POST /api/v1/admin/api-keys`

**Request**:
```javascript
const createAPIKey = async (appName, rateLimit, notes) => {
  const response = await authenticatedFetch(
    API_ENDPOINTS.API_KEYS,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_name: appName,      // Required
        rate_limit: rateLimit,  // Optional, default 60
        notes: notes            // Optional
      })
    }
  );
  return response.json();
};
```

**Success Response (201)**:
```json
{
  "api_key": "mhub_sk_live_abcdef1234567890...",
  "app_id": "app_new_001",
  "app_name": "New Application",
  "rate_limit": 100,
  "created_at": "2024-01-15T12:00:00Z"
}
```

**UI Components**:
- Create form:
  - Application name: [input, required]
  - Rate limit: [number input, default 60]
  - Notes: [textarea, optional]
- **IMPORTANT**: Show the full API key ONLY ONCE
- Copy button for API key
- Warning: "Save this key securely. You won't see it again!"

### 3. Revoke API Key

**Endpoint**: `DELETE /api/v1/admin/api-keys/:id`

**Request**:
```javascript
const revokeAPIKey = async (appId) => {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.API_KEYS}/${appId}`,
    {
      method: 'DELETE'
    }
  );
  return response.json();
};
```

**Success Response (200)**:
```json
{
  "message": "API key revoked successfully"
}
```

**UI Components**:
- Confirmation modal
- Warning about breaking applications

## Admin User Management

### 1. Create New Admin User

**Endpoint**: `POST /api/v1/admin/users`

**Request**:
```javascript
const createAdmin = async (email, name, password, role) => {
  const response = await authenticatedFetch(
    `${API_ENDPOINTS.CREATE_ADMIN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,       // Required, unique
        name: name,         // Required
        password: password, // Required, min 8 chars
        role: role         // Required: "admin" or "viewer"
      })
    }
  );
  return response.json();
};
```

**Success Response (201)**:
```json
{
  "id": "admin_new_001",
  "message": "admin user created successfully"
}
```

**Error Responses**:
- **409**: Email already exists
- **400**: Validation errors

**UI Components**:
- User form:
  - Email: [email input]
  - Name: [text input]
  - Password: [password input with strength meter]
  - Confirm Password: [password input]
  - Role: [select: Admin, Viewer]
- Password requirements display
- Success notification

## System Health & Monitoring

### 1. Health Check

**Endpoint**: `GET /healthz`

**Request**:
```javascript
const checkHealth = async () => {
  const response = await fetch(`${API_BASE_URL}/healthz`);
  return response.json();
};
```

**Success Response (200)**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-15T12:00:00Z"
}
```

### 2. Readiness Check

**Endpoint**: `GET /readyz`

**Request**:
```javascript
const checkReadiness = async () => {
  const response = await fetch(`${API_BASE_URL}/readyz`);
  return response.json();
};
```

**Success Response (200)**:
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

### 3. Metrics

**Endpoint**: `GET /metrics`

**Request**:
```javascript
const fetchMetrics = async () => {
  const response = await authenticatedFetch(`${API_BASE_URL}/metrics`);
  return response.text(); // Prometheus format
};
```

**Response**: Prometheus metrics format
```
# HELP license_requests_total Total license requests
# TYPE license_requests_total counter
license_requests_total 1234

# HELP license_verifications_total Total license verifications
# TYPE license_verifications_total counter
license_verifications_total 5678
```

**UI Components**:
- System status card (green/yellow/red)
- Service health indicators
- Metrics charts:
  - License requests over time
  - API key usage
  - Extension requests
  - Error rates

## Error Handling

### Global Error Handler

```javascript
const handleAPIError = (error, response) => {
  switch (response.status) {
    case 400:
      showNotification('Invalid request. Please check your input.', 'error');
      break;
    case 401:
      // Token expired or invalid
      logout();
      break;
    case 403:
      showNotification('You do not have permission for this action.', 'error');
      break;
    case 404:
      showNotification('Resource not found.', 'error');
      break;
    case 409:
      showNotification('Conflict: Resource already exists.', 'error');
      break;
    case 429:
      showNotification('Too many requests. Please wait.', 'error');
      break;
    case 500:
      showNotification('Server error. Please try again later.', 'error');
      break;
    default:
      showNotification('An unexpected error occurred.', 'error');
  }
};
```

## UI/UX Requirements

### Navigation Structure

```
Dashboard
├── Overview (default landing)
├── Licenses
│   ├── All Licenses
│   ├── Expiring Soon
│   └── Revoked
├── Extension Requests
│   ├── Pending (with badge)
│   ├── Approved
│   └── Rejected
├── API Keys
│   ├── Active Keys
│   └── Create New
├── Admin Users
│   └── Create User
└── System
    ├── Health Status
    └── Metrics
```

### Design Requirements

1. **Responsive Design**: Mobile, tablet, and desktop
2. **Dark/Light Mode**: User preference
3. **Real-time Updates**: WebSocket or polling for:
   - New extension requests
   - License expirations
   - System health changes
4. **Notifications**:
   - Success: Green toast
   - Error: Red toast
   - Warning: Yellow toast
   - Info: Blue toast
5. **Loading States**: Skeleton screens or spinners
6. **Empty States**: Helpful messages and actions
7. **Search**: Global search for licenses and customers
8. **Filters**: Date ranges, status, products
9. **Export**: CSV/Excel for reports
10. **Accessibility**: WCAG 2.1 AA compliance

### Security Requirements

1. **Token Management**:
   - Auto-refresh before expiry
   - Secure storage (httpOnly cookies preferred)
   - Clear on logout

2. **Input Validation**:
   - Client-side validation
   - XSS prevention
   - SQL injection prevention

3. **HTTPS Only**: Enforce in production

4. **Rate Limiting UI**:
   - Show remaining requests
   - Disable buttons when limited

### Dashboard Widgets

```javascript
// Example Dashboard Component Structure
const Dashboard = () => {
  return (
    <Grid container spacing={3}>
      {/* Stats Cards */}
      <Grid item xs={12} sm={6} md={3}>
        <StatsCard
          title="Active Licenses"
          value={stats.activeLicenses}
          icon={<LicenseIcon />}
          trend="+5% from last month"
        />
      </Grid>

      {/* Pending Requests Alert */}
      {pendingRequests > 0 && (
        <Alert severity="warning">
          You have {pendingRequests} pending extension requests
          <Button onClick={gotoPending}>Review Now</Button>
        </Alert>
      )}

      {/* Recent Activity */}
      <RecentActivity items={recentActivities} />

      {/* Charts */}
      <LicenseChart data={licenseData} />
      <UsageChart data={apiUsageData} />
    </Grid>
  );
};
```

## Testing Requirements

1. **Unit Tests**: All API calls and data transformations
2. **Integration Tests**: Full user workflows
3. **E2E Tests**: Critical paths (login, approve extension, create API key)
4. **Performance**: Handle 1000+ licenses in table
5. **Error Scenarios**: Network failures, invalid tokens

## Deployment Checklist

- [ ] Environment variables configured
- [ ] API URL pointing to production
- [ ] HTTPS enforced
- [ ] Error tracking (Sentry/similar)
- [ ] Analytics (optional)
- [ ] CI/CD pipeline
- [ ] Monitoring alerts
- [ ] Backup admin access
- [ ] Documentation for end users

## Support Features to Add

1. **Audit Log View**: Show all admin actions
2. **Bulk Operations**: Extend/revoke multiple licenses
3. **Email Templates**: Customize email content
4. **Webhooks Config**: Set up integrations
5. **License Templates**: Preset feature combinations
6. **Customer View**: See all licenses for a customer
7. **Search**: Global search across all entities

This comprehensive guide should enable a UI developer to build a complete, production-ready admin interface for the MaestroHUB License Server. All endpoints, request/response formats, error cases, and UI requirements are documented.