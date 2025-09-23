# Security Best Practices - MaestroHUB License Server

## Overview

This document outlines the security measures implemented in the MaestroHUB License Server to protect against abuse and unauthorized access.

## Authentication Layers

### 1. API Key Authentication (For Applications)

**Purpose**: Prevent unauthorized applications from requesting licenses

**Implementation**:
- Each application gets a unique API key: `mhub_sk_test_xxxxxxxxxxxxx`
- API keys are required for license request endpoints
- Keys are validated against the database
- Rate limiting is applied per API key

**How to use**:
```bash
curl -X POST https://license.maestrohub.com/api/v1/license/request \
  -H "X-API-Key: mhub_sk_test_xxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "company_name": "Company Inc",
    ...
  }'
```

### 2. JWT Authentication (For Admins)

**Purpose**: Secure admin operations

**Implementation**:
- Admins authenticate with username/password
- Receive JWT token valid for 8 hours
- Token required for all admin endpoints
- Role-based access control (RBAC)

**Protected operations**:
- Viewing extension requests
- Approving/rejecting extensions
- Manual license management
- Revoking licenses

## Protection Against Abuse

### 1. Rate Limiting

**Per API Key**:
- Default: 60 requests/minute
- Configurable per application
- Tracked in database

**Per IP Address**:
- Global rate limit for public endpoints
- 60 requests/minute by default
- In-memory tracking with cleanup

### 2. Email Validation

**Company Email Requirement**:
- Blocks public email domains (gmail.com, yahoo.com, etc.)
- Ensures only business users can request licenses
- Reduces spam and abuse

**Blocked domains**:
```go
var publicEmailDomains = []string{
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "aol.com", "icloud.com", "mail.com", "protonmail.com",
    // ... more domains
}
```

### 3. License Verification Security

**Cryptographic Signing**:
- Ed25519 signatures (quantum-resistant)
- Public key available for offline verification
- Signatures prevent tampering

**Revocation Support**:
- Real-time revocation list
- Cached for performance
- Checked during verification

## API Endpoint Security Matrix

| Endpoint | Authentication | Rate Limit | Additional Security |
|----------|---------------|------------|-------------------|
| `POST /api/v1/license/request` | API Key | Per API Key | Email validation, Company domain check |
| `POST /api/v1/license/verify` | None* | Per IP | Signature verification |
| `GET /.well-known/licensing-public-key` | None | Per IP | Read-only, cached |
| `GET /api/v1/revocations` | None | Per IP | Read-only, cached |
| `POST /api/v1/license/request-extension` | License ID + Email | Per IP | License ownership verification |
| `GET /api/v1/admin/*` | JWT | Per User | Admin role required |
| `POST /api/v1/admin/*` | JWT | Per User | Admin role required |

*Verify endpoint doesn't require auth as it's used by applications with existing licenses

## Database Security

### Sensitive Data Handling

1. **API Keys**:
   - Stored with prefix indexing
   - Full keys should be hashed (bcrypt) in production
   - Never logged or exposed in responses

2. **Private Keys**:
   - Encrypted at rest
   - Never exposed via API
   - Rotated periodically

3. **Customer Data**:
   - Minimal PII storage
   - Email addresses hashed for lookups
   - GDPR compliance ready

## Production Deployment Checklist

### Essential Security Steps

1. **Environment Variables**:
   ```bash
   LICENSE_JWT_SECRET=<strong-random-secret>
   LICENSE_DB_ENCRYPTION_KEY=<32-byte-key>
   ```

2. **HTTPS/TLS**:
   - Use TLS 1.3 minimum
   - Strong cipher suites only
   - HSTS headers enabled

3. **Database**:
   - Use PostgreSQL in production
   - Enable SSL connections
   - Regular backups
   - Encrypt at rest

4. **API Keys**:
   - Remove test keys
   - Implement proper hashing
   - Rotate regularly
   - Monitor usage

5. **Monitoring**:
   - Log all admin actions
   - Alert on suspicious patterns
   - Track failed authentication attempts
   - Monitor rate limit violations

## Threat Model & Mitigations

### Threat: License Request Spam
**Mitigation**: API key requirement + rate limiting + company email validation

### Threat: Unauthorized License Creation
**Mitigation**: API key authentication + audit logging

### Threat: License Tampering
**Mitigation**: Ed25519 cryptographic signatures

### Threat: Replay Attacks
**Mitigation**: License ID uniqueness + expiration dates + revocation support

### Threat: Admin Account Compromise
**Mitigation**: JWT with short expiry + audit logging + 2FA (recommended)

### Threat: DDoS Attacks
**Mitigation**: Rate limiting + CloudFlare/CDN + horizontal scaling

## Security Headers

Configure these headers in production:

```go
e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
    return func(c echo.Context) error {
        c.Response().Header().Set("X-Content-Type-Options", "nosniff")
        c.Response().Header().Set("X-Frame-Options", "DENY")
        c.Response().Header().Set("X-XSS-Protection", "1; mode=block")
        c.Response().Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        c.Response().Header().Set("Content-Security-Policy", "default-src 'self'")
        return next(c)
    }
})
```

## API Key Management

### Generating API Keys

```go
// Example API key generation
func generateAPIKey() string {
    prefix := "mhub_sk_live_" // or mhub_sk_test_ for test keys
    randomBytes := make([]byte, 32)
    rand.Read(randomBytes)
    return prefix + base64.URLEncoding.EncodeToString(randomBytes)[:32]
}
```

### API Key Best Practices

1. **Separate test and production keys**
2. **Rotate keys every 90 days**
3. **Monitor usage patterns**
4. **Implement key scoping (read/write permissions)**
5. **Never commit keys to version control**

## Incident Response

### If API Key is Compromised

1. Immediately deactivate the key in database
2. Generate new key for affected application
3. Audit recent requests from compromised key
4. Notify affected customers if necessary

### If Admin Account is Compromised

1. Revoke all JWT tokens (change JWT secret)
2. Force password reset
3. Audit recent admin actions
4. Review and potentially revoke affected licenses

## Compliance Considerations

### GDPR
- Minimal data collection
- Right to deletion implemented
- Data export capability
- Privacy policy compliance

### SOC 2
- Audit logging
- Access controls
- Encryption at rest and in transit
- Regular security reviews

## Testing Security

### Security Testing Checklist

```bash
# Test rate limiting
for i in {1..100}; do
  curl -X POST https://localhost:8080/api/v1/license/request \
    -H "X-API-Key: test_key" \
    -d '{"email":"test@company.com"}'
done

# Test email validation
curl -X POST https://localhost:8080/api/v1/license/request \
  -H "X-API-Key: test_key" \
  -d '{"email":"user@gmail.com"}' # Should be rejected

# Test authentication
curl -X GET https://localhost:8080/api/v1/admin/licenses \
  -H "Authorization: Bearer invalid_token" # Should fail
```

## Contact

For security issues, please email: security@maestrohub.com

Do NOT create public GitHub issues for security vulnerabilities.