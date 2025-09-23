# Complete User Journey - License Server Integration

## 📱 Scenario: User Downloads MaestroHUB Monitor Application

### Stage 1: Free Version (2-Hour Reset)

**User Experience:**
1. User downloads MaestroHUB Monitor application
2. Opens the app - it runs in "Free Mode"
3. After 2 hours, the app resets (loses configuration/state)
4. User sees a button: "Upgrade to Trial License"

**Application Code (What happens in the app):**
```go
// Application checks for license on startup
func checkLicense() {
    licenseFile := loadLicenseFromDisk("~/.maestrohub/license.json")

    if licenseFile == nil {
        // No license - run in free mode
        startFreeMode()
        scheduleReset(2 * time.Hour)
        showUpgradeButton()
    } else {
        // Verify license
        if verifyLicense(licenseFile) {
            startLicensedMode(licenseFile)
        } else {
            showLicenseExpired()
        }
    }
}
```

---

### Stage 2: User Requests Trial License

**User Action:**
- Clicks "Upgrade to Trial License" button
- Fills form with:
  - Email: john.doe@acmecorp.com
  - Company: ACME Corp
  - Name: John Doe
  - Role: DevOps Engineer
  - Purpose: Production monitoring

**Application → License Server Request:**
```bash
POST https://license.maestrohub.com/api/v1/license/request
Headers:
  X-API-Key: mhub_sk_live_xxxxx  # App's API key (hardcoded in app)
Body:
{
  "email": "john.doe@acmecorp.com",
  "company_name": "ACME Corp",
  "user_name": "John Doe",
  "role": "DevOps Engineer",
  "purpose": "Production monitoring",
  "product": "maestro-monitor"
}
```

**License Server Processing:**
```go
// In license_request_handler.go
func RequestLicense() {
    // 1. Validate company email ✅
    validateCompanyEmail("john.doe@acmecorp.com") // Pass - not gmail

    // 2. Check existing license ✅
    existingLicense = checkExistingLicense(email, product)
    if existingLicense != nil && isValid {
        // Resend existing license
        emailService.SendLicense(email, existingLicense)
        return "license_resent"
    }

    // 3. Create new customer ✅
    customer = CreateCustomer(email, company, name)

    // 4. Generate 30-day trial ✅
    license = CreateLicense({
        customer_id: customer.ID,
        product: "maestro-monitor",
        duration: "1m",
        features: {
            "dashboards": true,
            "alerts": false,
            "max_devices": 100
        }
    })

    // 5. Sign with Ed25519 ✅
    signedLicense = signer.Sign(license)

    // 6. Send email ✅
    emailService.SendLicense(email, signedLicense)
}
```

**Response to Application:**
```json
{
  "message": "license created and sent to your email",
  "status": "success"
}
```

---

### Stage 3: User Receives License Email

**Email Content:**
```
Subject: Your maestro-monitor License

Dear John Doe,

Your 30-day trial license has been created!

License ID: LIC-2024-ABCD
Valid From: January 1, 2024
Valid Until: January 31, 2024

Attachment: license-LIC-2024-ABCD.json
```

**Attached License File (JSON):**
```json
{
  "license_id": "LIC-2024-ABCD",
  "customer_id": "CUST-1234",
  "email": "john.doe@acmecorp.com",
  "company": "ACME Corp",
  "product": "maestro-monitor",
  "features": {
    "dashboards": true,
    "alerts": false,
    "max_devices": 100
  },
  "issued_at": "2024-01-01T00:00:00Z",
  "valid_until": "2024-01-31T00:00:00Z",
  "lifetime": false,
  "signature": "BASE64_ED25519_SIGNATURE"
}
```

---

### Stage 4: User Activates License in Application

**User Action:**
1. Downloads license file from email
2. In application: Settings → License → Import License
3. Selects the JSON file

**Application Verification Process:**

```go
// Application verifies license
func importLicense(licenseFile []byte) error {
    // 1. Parse license JSON
    license := parseLicense(licenseFile)

    // 2. Online verification (optional but recommended)
    resp := httpPost("https://license.maestrohub.com/api/v1/license/verify", {
        "license": base64(licenseFile)
    })

    if resp.valid {
        saveLicenseToDisk(licenseFile)
        applyLicenseFeatures(license.features)
        return nil
    }

    // 3. Offline verification (fallback)
    publicKey := getPublicKey() // Cached or from /.well-known/licensing-public-key
    if verifySignature(license, publicKey) {
        // Check expiration locally
        if license.valid_until > now() {
            saveLicenseToDisk(licenseFile)
            applyLicenseFeatures(license.features)
            return nil
        }
    }

    return errors.New("Invalid or expired license")
}
```

**🔴 POTENTIAL ISSUE FOUND:** How does the app know the license server URL?
- **Solution:** Hardcode in app or use well-known domain

---

### Stage 5: Application Runs in Licensed Mode

**Application Behavior:**
```go
// On every app startup
func startup() {
    license := loadLicense()

    // Check if still valid
    if license.lifetime || license.valid_until > now() {
        // Check revocation list (periodic)
        if !isRevoked(license.license_id) {
            runInLicensedMode()
        }
    } else {
        showExpiredMessage()
        runInFreeMode()
    }
}

// Periodic checks (every 24 hours)
func periodicLicenseCheck() {
    // Check revocation list
    revocations := httpGet("https://license.maestrohub.com/api/v1/revocations")
    if contains(revocations, license.license_id) {
        disableLicense()
    }

    // Check expiration
    if license.valid_until < now() + 7*days {
        showExpirationWarning()
    }
}
```

---

### Stage 6: License Expires After 30 Days

**Day 23 - Warning:**
```go
// Application shows warning
showNotification("Your license expires in 7 days. Request an extension?")
```

**Day 30 - Expiration:**
```go
// License expires
if license.valid_until < now() {
    showMessage("License expired. Request extension?")
    // Button: "Request Extension"
}
```

---

### Stage 7: User Requests Extension

**User Action:**
- Clicks "Request Extension" in app
- Fills reason: "Need more time for evaluation"

**Application → License Server:**
```bash
POST https://license.maestrohub.com/api/v1/license/request-extension
Body:
{
  "license_id": "LIC-2024-ABCD",
  "email": "john.doe@acmecorp.com",
  "requested_months": 3,
  "reason": "Need more time for POC completion"
}
```

**License Server Processing:**
```go
func RequestExtension() {
    // 1. Verify license belongs to email ✅
    license = GetLicense(license_id)
    customer = GetCustomerByEmail(email)

    if license.customer_id != customer.id {
        return error("License doesn't belong to this email")
    }

    // 2. Create extension request ✅
    request = CreateExtensionRequest({
        license_id: license_id,
        customer_id: customer.id,
        requested_months: 3,
        reason: reason,
        status: "pending"
    })

    // 3. Notify admins (MISSING!) 🔴
    // We should add this!
    emailService.NotifyAdmins("New extension request", request)

    return {
        "message": "extension request submitted",
        "request_id": request.id
    }
}
```

---

### Stage 8: Admin Reviews Extension Request

**Admin Actions:**
1. Admin logs into dashboard
2. Views pending extension requests
3. Approves with 2 months (not full 3 requested)

**Admin → License Server:**
```bash
POST https://license.maestrohub.com/api/v1/admin/extension-requests/REQ-123/approve
Headers:
  Authorization: Bearer JWT_TOKEN
Body:
{
  "approved_months": 2,
  "notes": "Approved 2 months for POC"
}
```

**License Server Processing:**
```go
func ApproveExtension() {
    // 1. Update extension request ✅
    UpdateRequest(status: "approved", approved_months: 2)

    // 2. Extend the license ✅
    license = GetLicense(request.license_id)
    license.valid_until = license.valid_until.AddMonths(2)
    UpdateLicense(license)

    // 3. Generate new signed license ✅
    newSignedLicense = signer.Sign(license)

    // 4. Email new license to customer ✅
    customer = GetCustomer(license.customer_id)
    emailService.SendExtension(customer.email, newSignedLicense)
}
```

---

### Stage 9: User Receives Extended License

**Email:**
```
Subject: License Extended - maestro-monitor

Your license has been extended!
New Expiry Date: March 31, 2024

Attachment: license-LIC-2024-ABCD-extended.json
```

**User Action:**
1. Downloads new license file
2. Imports into application
3. Application validates and applies new expiry date

---

## 🔴 Issues Found & Solutions

### 1. **Missing: Admin Notification for Extension Requests**
```go
// Add to extension_handler.go
func RequestExtension() {
    // ... existing code ...

    // Notify admins
    admins := getAdminEmails()
    for _, admin := range admins {
        emailService.SendAdminNotification(admin,
            "New Extension Request",
            fmt.Sprintf("Customer %s requested %d months extension",
                customer.email, requested_months))
    }
}
```

### 2. **Missing: Application SDK/Library**
The application needs helper code:

```go
// Create pkg/client/sdk.go
package client

import (
    "encoding/json"
    "crypto/ed25519"
)

type LicenseClient struct {
    serverURL string
    publicKey ed25519.PublicKey
}

func NewLicenseClient(serverURL string) *LicenseClient {
    return &LicenseClient{
        serverURL: serverURL,
    }
}

func (c *LicenseClient) VerifyLicense(licenseData []byte) (bool, error) {
    // Implementation
}

func (c *LicenseClient) CheckRevocation(licenseID string) (bool, error) {
    // Implementation
}
```

### 3. **Missing: Grace Period After Expiration**
```go
// Add grace period logic
func checkLicenseValidity(license *License) LicenseStatus {
    now := time.Now()

    if license.Lifetime {
        return LicenseActive
    }

    if now.Before(license.ValidUntil) {
        return LicenseActive
    }

    gracePeriod := 7 * 24 * time.Hour
    if now.Before(license.ValidUntil.Add(gracePeriod)) {
        return LicenseGracePeriod // Show warnings but keep working
    }

    return LicenseExpired
}
```

### 4. **Missing: Automatic Expiry Warnings**
```go
// Add cron job to warn users
func sendExpiryWarnings() {
    licenses := getExpiringLicenses(7) // Expiring in 7 days

    for _, license := range licenses {
        customer := getCustomer(license.CustomerID)
        emailService.SendExpiryWarning(customer.Email, license, 7)
    }
}
```

---

## ✅ What's Working Well

1. **License Creation Flow** ✅
2. **Email Validation** ✅
3. **Cryptographic Signatures** ✅
4. **Extension Request System** ✅
5. **Admin Management** ✅
6. **API Security** ✅

## 🔴 What Should Be Added

1. **Admin Notifications** for new extension requests
2. **Application SDK** for easier integration
3. **Grace Period** after expiration
4. **Automatic Expiry Warnings** via cron/scheduler
5. **License Analytics** (usage tracking)
6. **Webhook Support** for real-time updates

The core system is solid, but these additions would make it more user-friendly and production-ready!