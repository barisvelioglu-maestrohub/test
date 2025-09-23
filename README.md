# MaestroHUB License Server

Production-grade licensing server for MaestroHUB products, built with Go and Echo framework.

## Features

- **Application-Initiated Licensing**: Applications request licenses for users
- **Company Email Validation**: Only company emails allowed (no public domains)
- **Feature-based Licensing**: Boolean flags, tiers, and quotas
- **License Durations**: 1/3/6/12 months and lifetime licenses
- **Extension Request Workflow**: Customers request extensions, admins approve/reject
- **Email Delivery**: Direct license delivery via email
- **Revocation System**: Real-time license revocation
- **Secure Signing**: Ed25519 cryptographic signatures
- **SQLite/PostgreSQL**: Flexible database support

## Quick Start

### Prerequisites

- Go 1.21+
- SQLite3 (default) or PostgreSQL

### Installation

```bash
# Clone the repository
git clone https://github.com/maestrohub/license-server
cd license-server

# Install dependencies
go mod download

# Run the server
go run cmd/server/main.go
```

### Configuration

Copy `config.yaml` and customize:

```bash
cp config.yaml config.local.yaml
# Edit config.local.yaml with your settings
go run cmd/server/main.go -config config.local.yaml
```

## License Workflow

### Simple License Flow

```
1. Application requests license for user
   └─> License Server validates email (company domain)
       └─> Creates 30-day trial license
           └─> Sends license via email
               └─> User receives license file

2. User needs extension
   └─> Submits extension request
       └─> Admin reviews request
           └─> Approves/Rejects
               └─> Extended license sent via email
```

## API Documentation

### Public Endpoints (No Authentication)

#### Request License (Application → Server)
```
POST /api/v1/license/request
{
  "email": "user@company.com",
  "company_name": "Company Inc",
  "user_name": "John Doe",
  "role": "DevOps Engineer",
  "purpose": "Production monitoring",
  "product": "maestro-monitor",
  "order_number": "ORD-123"  // optional
}
```
Response: `{"message": "license created and sent to your email", "status": "success"}`

**Note**: Email must be a company domain (gmail.com, yahoo.com, etc. are blocked)

#### Verify License Signature
```
POST /api/v1/license/verify
{
  "license": "base64-encoded-license-data"
}
```

#### Get Public Key (For Offline Verification)
```
GET /.well-known/licensing-public-key
```

#### Get Revoked Licenses
```
GET /api/v1/revocations
```

#### Request Extension (Customer → Server)
```
POST /api/v1/license/request-extension
{
  "license_id": "LIC-XXXX",
  "email": "user@company.com",
  "requested_months": 3,
  "reason": "Need more time for evaluation"
}
```

### Admin Endpoints (JWT Authentication Required)

#### View Extension Requests
```
GET /api/v1/admin/extension-requests?status=pending
GET /api/v1/admin/extension-requests/{id}
```

#### Approve Extension Request
```
POST /api/v1/admin/extension-requests/{id}/approve
{
  "approved_months": 3,
  "notes": "Approved for continued evaluation"
}
```

#### Reject Extension Request
```
POST /api/v1/admin/extension-requests/{id}/reject
{
  "notes": "Please contact sales for commercial license"
}
```

#### License Management
```
GET /api/v1/admin/licenses              # List all licenses
GET /api/v1/admin/licenses/{id}         # Get specific license
POST /api/v1/admin/licenses/extend/{id} # Extend license directly
POST /api/v1/admin/licenses/revoke/{id} # Revoke license
```

### Health & Monitoring

```
GET /healthz    # Basic health check
GET /readyz     # Readiness check
GET /metrics    # Prometheus metrics
```

## Application Integration

### Requesting a License from Your Application

Applications should call the license request endpoint when a user needs a license:

```go
// Example Go code
client := &http.Client{}
reqBody, _ := json.Marshal(map[string]string{
    "email": userEmail,
    "company_name": companyName,
    "user_name": userName,
    "role": userRole,
    "purpose": "Production use",
    "product": "maestro-monitor",
})

resp, err := client.Post(
    "https://license.maestrohub.com/api/v1/license/request",
    "application/json",
    bytes.NewBuffer(reqBody),
)
```

### Verifying a License

Applications can verify licenses either:

1. **Online**: Call the `/api/v1/license/verify` endpoint
2. **Offline**: Use the public key from `/.well-known/licensing-public-key`

```go
// Example offline verification
import "github.com/maestrohub/license-server/pkg/client"

verifier := client.NewLicenseVerifier(publicKey)
valid, err := verifier.Verify(licenseData)
```

## Architecture

### Components

- **API Layer**: Echo framework with middleware
- **Service Layer**: Business logic and validation
- **Repository Layer**: Database abstraction
- **Crypto Module**: Ed25519 signing and verification
- **Email Service**: Direct SMTP email delivery

### Database Schema

Key tables:
- `licenses`: Core license records
- `customers`: Customer information
- `extension_requests`: Extension request management
- `revoked_licenses`: Revoked licenses
- `keys`: Signing keys

## Security

- **Ed25519 Signatures**: Cryptographically secure license signing
- **Email Validation**: Only company emails allowed (no public domains)
- **JWT Authentication**: Secure admin endpoint access
- **Rate Limiting**: Configurable per-minute request limits
- **CORS Protection**: Configurable allowed origins
- **Revocation Support**: Ability to revoke compromised licenses

## Development

### Running Tests
```bash
go test ./...
```

### Database Migrations
```bash
# SQLite (automatic on startup)
# PostgreSQL
migrate -path migrations -database "postgres://..." up
```

### Building
```bash
go build -o license-server cmd/server/main.go
```

### Docker
```bash
docker build -t license-server .
docker run -p 8080:8080 -v ./config.yaml:/config.yaml license-server
```

## Environment Variables

Override config with environment variables:
```bash
LICENSE_SERVER_PORT=8080
LICENSE_DATABASE_DSN=./license.db
LICENSE_JWT_SECRET=your-secret-key
LICENSE_EMAIL_SMTP_HOST=smtp.gmail.com
```

## License Format

Licenses are JWT tokens with Ed25519 signatures:

```json
{
  "license_id": "LIC-XXXX-XXXX",
  "customer_id": "CUST-XXXX",
  "email": "user@company.com",
  "company": "Company Inc",
  "product": "maestro-monitor",
  "features": {
    "dashboards": true,
    "alerts": false,
    "reports_tier": "basic",
    "max_devices": 100
  },
  "seats": 1,
  "issued_at": "2024-01-01T00:00:00Z",
  "valid_until": "2024-02-01T00:00:00Z",
  "lifetime": false
}
```

### Feature Types

- **Booleans**: `"dashboards": true`
- **Tiers**: `"reports_tier": "basic"|"pro"|"enterprise"`
- **Quotas**: `"max_devices": 100`
- **Custom**: Any JSON-compatible value


## Deployment

### Production Checklist

1. Set strong JWT secret
2. Configure email provider
3. Enable HTTPS
4. Set up database backups
5. Configure monitoring
6. Rotate signing keys regularly
7. Review CORS settings
8. Enable rate limiting

### Systemd Service

```ini
[Unit]
Description=License Server
After=network.target

[Service]
Type=simple
User=license
WorkingDirectory=/opt/license-server
ExecStart=/opt/license-server/license-server
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## API Client SDK

### Go Client
```go
client := sdk.NewLicenseClient("https://license.example.com", apiKey)
license, err := client.CreateLicense(ctx, &sdk.CreateLicenseRequest{
    CustomerID: "cust_123",
    Product:    "maestrohub-core",
    Duration:   "12m",
})
```

### TypeScript Client
```typescript
const client = new LicenseClient('https://license.example.com', apiKey);
const license = await client.createLicense({
  customerId: 'cust_123',
  product: 'maestrohub-core',
  duration: '12m',
});
```

## Monitoring

Prometheus metrics available at `/metrics`:
- `license_requests_total`
- `license_verifications_total`
- `extension_requests_total`
- `email_sends_total`

## Support

For issues and questions:
- GitHub Issues: https://github.com/maestrohub/license-server/issues
- Documentation: https://docs.maestrohub.com/licensing

## License

MIT License - See LICENSE file for details