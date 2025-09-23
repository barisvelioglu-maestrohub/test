package client

import (
	"bytes"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/maestrohub/license-server/pkg/models"
)

// LicenseClient provides methods for applications to interact with licenses
type LicenseClient struct {
	serverURL  string
	apiKey     string
	publicKey  ed25519.PublicKey
	httpClient *http.Client
	cacheDir   string
}

// NewLicenseClient creates a new license client
func NewLicenseClient(serverURL, apiKey string) *LicenseClient {
	homeDir, _ := os.UserHomeDir()
	cacheDir := filepath.Join(homeDir, ".maestrohub")
	os.MkdirAll(cacheDir, 0755)

	return &LicenseClient{
		serverURL: serverURL,
		apiKey:    apiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		cacheDir: cacheDir,
	}
}

// RequestLicense requests a new trial license from the server
func (c *LicenseClient) RequestLicense(email, company, userName, role, purpose, product string) error {
	payload := map[string]string{
		"email":        email,
		"company_name": company,
		"user_name":    userName,
		"role":         role,
		"purpose":      purpose,
		"product":      product,
	}

	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", c.serverURL+"/api/v1/license/request", bytes.NewBuffer(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to request license: %s", string(body))
	}

	return nil
}

// LoadLicense loads a license from disk
func (c *LicenseClient) LoadLicense() (*models.License, error) {
	licensePath := filepath.Join(c.cacheDir, "license.json")

	data, err := os.ReadFile(licensePath)
	if err != nil {
		return nil, fmt.Errorf("no license found: %w", err)
	}

	var license models.License
	if err := json.Unmarshal(data, &license); err != nil {
		return nil, fmt.Errorf("invalid license format: %w", err)
	}

	return &license, nil
}

// SaveLicense saves a license to disk
func (c *LicenseClient) SaveLicense(licenseData []byte) error {
	// Validate it's valid JSON
	var license models.License
	if err := json.Unmarshal(licenseData, &license); err != nil {
		return fmt.Errorf("invalid license format: %w", err)
	}

	licensePath := filepath.Join(c.cacheDir, "license.json")
	return os.WriteFile(licensePath, licenseData, 0600)
}

// ImportLicenseFile imports a license from a file path
func (c *LicenseClient) ImportLicenseFile(filePath string) error {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read license file: %w", err)
	}

	// Verify online first
	valid, err := c.VerifyLicenseOnline(data)
	if err == nil && valid {
		return c.SaveLicense(data)
	}

	// Fallback to offline verification
	valid, err = c.VerifyLicenseOffline(data)
	if err != nil {
		return err
	}

	if !valid {
		return fmt.Errorf("invalid or expired license")
	}

	return c.SaveLicense(data)
}

// VerifyLicenseOnline verifies a license with the server
func (c *LicenseClient) VerifyLicenseOnline(licenseData []byte) (bool, error) {
	payload := map[string]string{
		"license": base64.StdEncoding.EncodeToString(licenseData),
	}

	body, _ := json.Marshal(payload)

	resp, err := c.httpClient.Post(
		c.serverURL+"/api/v1/license/verify",
		"application/json",
		bytes.NewBuffer(body),
	)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	var result struct {
		Valid     bool      `json:"valid"`
		LicenseID string    `json:"license_id"`
		ExpiresAt time.Time `json:"expires_at"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}

	return result.Valid, nil
}

// VerifyLicenseOffline verifies a license using cached public key
func (c *LicenseClient) VerifyLicenseOffline(licenseData []byte) (bool, error) {
	// Get public key
	if c.publicKey == nil {
		if err := c.FetchPublicKey(); err != nil {
			return false, fmt.Errorf("failed to get public key: %w", err)
		}
	}

	var license models.License
	if err := json.Unmarshal(licenseData, &license); err != nil {
		return false, err
	}

	// Check expiration
	if !license.Lifetime && license.ValidUntil != nil {
		if time.Now().After(*license.ValidUntil) {
			return false, fmt.Errorf("license expired on %s", license.ValidUntil.Format("2006-01-02"))
		}
	}

	// Verify signature
	signature, err := base64.StdEncoding.DecodeString(license.Signature)
	if err != nil {
		return false, err
	}

	// Create canonical JSON for verification (without signature field)
	license.Signature = ""
	canonicalJSON, err := json.Marshal(license)
	if err != nil {
		return false, err
	}

	valid := ed25519.Verify(c.publicKey, canonicalJSON, signature)
	return valid, nil
}

// FetchPublicKey fetches and caches the public key
func (c *LicenseClient) FetchPublicKey() error {
	resp, err := c.httpClient.Get(c.serverURL + "/.well-known/licensing-public-key")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	pemData, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	// Parse PEM
	block, _ := pem.Decode(pemData)
	if block == nil || block.Type != "PUBLIC KEY" {
		return fmt.Errorf("invalid public key format")
	}

	c.publicKey = ed25519.PublicKey(block.Bytes)

	// Cache it
	keyPath := filepath.Join(c.cacheDir, "public.pem")
	os.WriteFile(keyPath, pemData, 0644)

	return nil
}

// CheckRevocation checks if a license is revoked
func (c *LicenseClient) CheckRevocation(licenseID string) (bool, error) {
	resp, err := c.httpClient.Get(c.serverURL + "/api/v1/revocations")
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	var revocations struct {
		Revoked []string `json:"revoked"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&revocations); err != nil {
		return false, err
	}

	for _, revoked := range revocations.Revoked {
		if revoked == licenseID {
			return true, nil
		}
	}

	return false, nil
}

// RequestExtension requests a license extension
func (c *LicenseClient) RequestExtension(licenseID, email string, months int, reason string) error {
	payload := map[string]interface{}{
		"license_id":       licenseID,
		"email":            email,
		"requested_months": months,
		"reason":           reason,
	}

	body, _ := json.Marshal(payload)

	resp, err := c.httpClient.Post(
		c.serverURL+"/api/v1/license/request-extension",
		"application/json",
		bytes.NewBuffer(body),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to request extension: %s", string(body))
	}

	return nil
}

// GetLicenseStatus returns the current license status
func (c *LicenseClient) GetLicenseStatus() (LicenseStatus, *models.License, error) {
	license, err := c.LoadLicense()
	if err != nil {
		return StatusNoLicense, nil, nil
	}

	// Check if revoked
	revoked, _ := c.CheckRevocation(license.LicenseID)
	if revoked {
		return StatusRevoked, license, nil
	}

	// Check expiration
	if license.Lifetime {
		return StatusActive, license, nil
	}

	if license.ValidUntil == nil {
		return StatusInvalid, license, nil
	}

	now := time.Now()
	if now.Before(*license.ValidUntil) {
		// Check if expiring soon
		daysUntilExpiry := int(license.ValidUntil.Sub(now).Hours() / 24)
		if daysUntilExpiry <= 7 {
			return StatusExpiringSoon, license, nil
		}
		return StatusActive, license, nil
	}

	// Grace period (7 days after expiration)
	gracePeriod := license.ValidUntil.Add(7 * 24 * time.Hour)
	if now.Before(gracePeriod) {
		return StatusGracePeriod, license, nil
	}

	return StatusExpired, license, nil
}

// LicenseStatus represents the current state of a license
type LicenseStatus int

const (
	StatusNoLicense LicenseStatus = iota
	StatusActive
	StatusExpiringSoon
	StatusGracePeriod
	StatusExpired
	StatusRevoked
	StatusInvalid
)

func (s LicenseStatus) String() string {
	switch s {
	case StatusNoLicense:
		return "No License"
	case StatusActive:
		return "Active"
	case StatusExpiringSoon:
		return "Expiring Soon"
	case StatusGracePeriod:
		return "Grace Period"
	case StatusExpired:
		return "Expired"
	case StatusRevoked:
		return "Revoked"
	case StatusInvalid:
		return "Invalid"
	default:
		return "Unknown"
	}
}

// ShouldAllowOperation returns whether the application should allow operations
func (s LicenseStatus) ShouldAllowOperation() bool {
	switch s {
	case StatusActive, StatusExpiringSoon, StatusGracePeriod:
		return true
	default:
		return false
	}
}

// ShowWarning returns whether to show a warning to the user
func (s LicenseStatus) ShowWarning() bool {
	switch s {
	case StatusExpiringSoon, StatusGracePeriod:
		return true
	default:
		return false
	}
}