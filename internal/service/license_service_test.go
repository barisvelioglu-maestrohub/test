package service_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/maestrohub/license-server/internal/config"
	"github.com/maestrohub/license-server/internal/crypto"
	"github.com/maestrohub/license-server/internal/repository"
	"github.com/maestrohub/license-server/internal/service"
	"github.com/maestrohub/license-server/pkg/models"
)

func setupTest(t *testing.T) (*repository.Database, service.LicenseService, func()) {
	cfg := &config.DatabaseConfig{
		Driver:          "sqlite3",
		DSN:             ":memory:",
		MaxOpenConns:    5,
		MaxIdleConns:    2,
		ConnMaxLifetime: 5 * time.Minute,
	}

	db, err := repository.NewDatabase(cfg)
	require.NoError(t, err)

	err = db.Migrate()
	require.NoError(t, err)

	signer := crypto.NewEd25519Signer()
	kp, err := signer.GenerateKeyPair()
	require.NoError(t, err)
	signer.SetActiveKey(kp.KID)

	licenseRepo := repository.NewLicenseRepository(db)
	customerRepo := repository.NewCustomerRepository(db)
	extensionRepo := repository.NewExtensionRequestRepository(db)

	customer := &models.Customer{
		ID:    "cust_test",
		Name:  "Test Company",
		Email: "test@example.com",
	}
	err = customerRepo.Create(db, customer)
	require.NoError(t, err)

	licenseService := service.NewLicenseService(db, licenseRepo, customerRepo, extensionRepo, signer)

	cleanup := func() {
		db.Close()
	}

	return db, licenseService, cleanup
}

func TestCreateLicense(t *testing.T) {
	_, licenseService, cleanup := setupTest(t)
	defer cleanup()

	req := &service.CreateLicenseRequest{
		CustomerID: "cust_test",
		Product:    "test-product",
		Duration:   "12m",
		Lifetime:   false,
		Seats:      10,
		Features: map[string]interface{}{
			"feature1": true,
			"feature2": "premium",
			"max_users": 100,
		},
		Notes: "Test license",
	}

	license, err := licenseService.CreateLicense(req)
	require.NoError(t, err)
	assert.NotEmpty(t, license.LicenseID)
	assert.Equal(t, "cust_test", license.CustomerID)
	assert.Equal(t, "test-product", license.Product)
	assert.Equal(t, 10, license.Seats)
	assert.Equal(t, true, license.Features["feature1"])
	assert.Equal(t, "premium", license.Features["feature2"])
	assert.Equal(t, float64(100), license.Features["max_users"])
	assert.NotEmpty(t, license.SignatureB64)
	assert.NotEmpty(t, license.KID)
}

func TestCreateLifetimeLicense(t *testing.T) {
	_, licenseService, cleanup := setupTest(t)
	defer cleanup()

	req := &service.CreateLicenseRequest{
		CustomerID: "cust_test",
		Product:    "test-product",
		Lifetime:   true,
		Features: map[string]interface{}{
			"unlimited": true,
		},
	}

	license, err := licenseService.CreateLicense(req)
	require.NoError(t, err)
	assert.True(t, license.Lifetime)
	assert.Nil(t, license.ValidUntil)
}

func TestExtendLicense(t *testing.T) {
	_, licenseService, cleanup := setupTest(t)
	defer cleanup()

	req := &service.CreateLicenseRequest{
		CustomerID: "cust_test",
		Product:    "test-product",
		Duration:   "1m",
		Features:   map[string]interface{}{"test": true},
	}

	license, err := licenseService.CreateLicense(req)
	require.NoError(t, err)

	originalExpiry := license.ValidUntil
	require.NotNil(t, originalExpiry)

	extended, err := licenseService.ExtendLicense(license.LicenseID, 6)
	require.NoError(t, err)
	assert.NotNil(t, extended.ValidUntil)
	assert.True(t, extended.ValidUntil.After(*originalExpiry))
}

func TestExtendLicenseMaxMonths(t *testing.T) {
	_, licenseService, cleanup := setupTest(t)
	defer cleanup()

	req := &service.CreateLicenseRequest{
		CustomerID: "cust_test",
		Product:    "test-product",
		Duration:   "1m",
		Features:   map[string]interface{}{"test": true},
	}

	license, err := licenseService.CreateLicense(req)
	require.NoError(t, err)

	_, err = licenseService.ExtendLicense(license.LicenseID, 13)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cannot exceed 12 months")
}

func TestRevokeLicense(t *testing.T) {
	db, licenseService, cleanup := setupTest(t)
	defer cleanup()

	req := &service.CreateLicenseRequest{
		CustomerID: "cust_test",
		Product:    "test-product",
		Duration:   "12m",
		Features:   map[string]interface{}{"test": true},
	}

	license, err := licenseService.CreateLicense(req)
	require.NoError(t, err)

	err = licenseService.RevokeLicense(license.LicenseID, "Test revocation", "test-user")
	require.NoError(t, err)

	var status string
	query := `SELECT status FROM licenses WHERE id = ?`
	err = db.Get(&status, query, license.LicenseID)
	require.NoError(t, err)
	assert.Equal(t, "revoked", status)

	err = licenseService.RevokeLicense(license.LicenseID, "Test revocation", "test-user")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already revoked")
}

func TestVerifyLicense(t *testing.T) {
	_, licenseService, cleanup := setupTest(t)
	defer cleanup()

	req := &service.CreateLicenseRequest{
		CustomerID: "cust_test",
		Product:    "test-product",
		Duration:   "12m",
		Features:   map[string]interface{}{"test": true},
	}

	license, err := licenseService.CreateLicense(req)
	require.NoError(t, err)

	err = licenseService.VerifyLicense(license)
	assert.NoError(t, err)

	license.SignatureB64 = "invalid-signature"
	err = licenseService.VerifyLicense(license)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "signature verification failed")
}

func TestGetCustomerLicenses(t *testing.T) {
	_, licenseService, cleanup := setupTest(t)
	defer cleanup()

	for i := 0; i < 3; i++ {
		req := &service.CreateLicenseRequest{
			CustomerID: "cust_test",
			Product:    "test-product",
			Duration:   "12m",
			Features:   map[string]interface{}{"test": true},
		}
		_, err := licenseService.CreateLicense(req)
		require.NoError(t, err)
	}

	licenses, err := licenseService.GetCustomerLicenses("cust_test")
	require.NoError(t, err)
	assert.Len(t, licenses, 3)
}

func TestGetExpiringLicenses(t *testing.T) {
	_, licenseService, cleanup := setupTest(t)
	defer cleanup()

	req1 := &service.CreateLicenseRequest{
		CustomerID: "cust_test",
		Product:    "test-product",
		Duration:   "1m",
		Features:   map[string]interface{}{"test": true},
	}
	_, err := licenseService.CreateLicense(req1)
	require.NoError(t, err)

	req2 := &service.CreateLicenseRequest{
		CustomerID: "cust_test",
		Product:    "test-product",
		Duration:   "12m",
		Features:   map[string]interface{}{"test": true},
	}
	_, err = licenseService.CreateLicense(req2)
	require.NoError(t, err)

	expiring, err := licenseService.GetExpiringLicenses(35)
	require.NoError(t, err)
	assert.Len(t, expiring, 1)
}

func TestExtensionRequestWorkflow(t *testing.T) {
	_, licenseService, cleanup := setupTest(t)
	defer cleanup()

	// Create a license
	req := &service.CreateLicenseRequest{
		CustomerID: "cust_test",
		Product:    "test-product",
		Duration:   "1m",
		Features:   map[string]interface{}{"test": true},
	}
	license, err := licenseService.CreateLicense(req)
	require.NoError(t, err)

	// Request extension
	extReq, err := licenseService.RequestExtension(
		license.LicenseID,
		"cust_test",
		6,
		"Need more time for project",
		"customer@test.com",
	)
	require.NoError(t, err)
	assert.Equal(t, models.ExtensionRequestPending, extReq.Status)

	// Get pending requests
	pendingStatus := models.ExtensionRequestPending
	pending, err := licenseService.GetExtensionRequests(&pendingStatus)
	require.NoError(t, err)
	assert.Len(t, pending, 1)

	// Approve extension
	err = licenseService.ApproveExtensionRequest(
		extReq.ID,
		6,
		"admin@test.com",
		"Approved for development",
	)
	require.NoError(t, err)

	// Verify license was extended
	updatedLicense, err := licenseService.GetLicense(license.LicenseID)
	require.NoError(t, err)
	assert.True(t, updatedLicense.ValidUntil.After(*license.ValidUntil))
}

