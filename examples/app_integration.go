package main

import (
	"fmt"
	"log"
	"time"

	"github.com/maestrohub/license-server/pkg/client"
)

// Example application integration
type Application struct {
	licenseClient *client.LicenseClient
	currentStatus client.LicenseStatus
	resetTimer    *time.Timer
}

func NewApplication() *Application {
	// Initialize with your license server URL and API key
	// API key would be embedded in the compiled application
	licenseClient := client.NewLicenseClient(
		"https://license.maestrohub.com",
		"mhub_sk_live_your_api_key_here", // Embedded in app binary
	)

	return &Application{
		licenseClient: licenseClient,
	}
}

// StartupCheck runs when application starts
func (app *Application) StartupCheck() {
	fmt.Println("🚀 MaestroHUB Monitor Starting...")

	// Check license status
	status, license, err := app.licenseClient.GetLicenseStatus()
	if err != nil {
		fmt.Printf("⚠️  Error checking license: %v\n", err)
	}

	app.currentStatus = status

	switch status {
	case client.StatusNoLicense:
		fmt.Println("📋 No license found - Running in FREE mode")
		fmt.Println("⏰ Application will reset every 2 hours")
		app.startFreeMode()

	case client.StatusActive:
		fmt.Printf("✅ License active until %s\n",
			license.ValidUntil.Format("2006-01-02"))
		app.startLicensedMode(license)

	case client.StatusExpiringSoon:
		days := int(license.ValidUntil.Sub(time.Now()).Hours() / 24)
		fmt.Printf("⚠️  License expiring in %d days!\n", days)
		fmt.Println("📧 Click 'Request Extension' to extend your license")
		app.startLicensedMode(license)
		app.showExpiryWarning(days)

	case client.StatusGracePeriod:
		fmt.Println("⚠️  License expired - Running in GRACE PERIOD")
		fmt.Println("📧 Please request an extension to continue using all features")
		app.startLicensedMode(license)
		app.showGracePeriodWarning()

	case client.StatusExpired:
		fmt.Println("❌ License expired")
		fmt.Println("📧 Request an extension or the app will run in FREE mode")
		app.startFreeMode()
		app.showExpiredDialog()

	case client.StatusRevoked:
		fmt.Println("🚫 License has been revoked")
		fmt.Println("📞 Please contact support")
		app.startFreeMode()

	case client.StatusInvalid:
		fmt.Println("❌ Invalid license file")
		app.startFreeMode()
	}

	// Start periodic checks
	go app.periodicLicenseCheck()
}

// startFreeMode runs the app with limitations
func (app *Application) startFreeMode() {
	fmt.Println("\n=== FREE MODE ===")
	fmt.Println("Features available:")
	fmt.Println("  ✓ Basic monitoring")
	fmt.Println("  ✗ Dashboards (disabled)")
	fmt.Println("  ✗ Alerts (disabled)")
	fmt.Println("  ✗ Reports (disabled)")

	// Schedule reset after 2 hours
	app.resetTimer = time.AfterFunc(2*time.Hour, func() {
		fmt.Println("\n⏰ 2-hour limit reached - Resetting application...")
		app.resetApplication()
	})

	// Show upgrade button
	app.showUpgradeButton()
}

// startLicensedMode runs the app with full features
func (app *Application) startLicensedMode(license *models.License) {
	fmt.Println("\n=== LICENSED MODE ===")
	fmt.Printf("License ID: %s\n", license.LicenseID)
	fmt.Printf("Company: %s\n", license.Company)

	// Apply features from license
	features := license.Features.(map[string]interface{})

	fmt.Println("Features enabled:")
	if features["dashboards"] == true {
		fmt.Println("  ✓ Dashboards")
	}
	if features["alerts"] == true {
		fmt.Println("  ✓ Alerts")
	}
	if tier, ok := features["reports_tier"].(string); ok {
		fmt.Printf("  ✓ Reports (Tier: %s)\n", tier)
	}
	if maxDevices, ok := features["max_devices"].(float64); ok {
		fmt.Printf("  ✓ Max Devices: %d\n", int(maxDevices))
	}

	// Cancel any reset timer
	if app.resetTimer != nil {
		app.resetTimer.Stop()
	}
}

// User clicks "Upgrade to Trial" button
func (app *Application) OnUpgradeButtonClick() {
	fmt.Println("\n📝 Requesting Trial License...")

	// In a real app, this would be a form dialog
	err := app.licenseClient.RequestLicense(
		"john.doe@acmecorp.com", // From user input
		"ACME Corp",              // From user input
		"John Doe",               // From user input
		"DevOps Engineer",        // From user input
		"Production monitoring",  // From user input
		"maestro-monitor",        // Product name
	)

	if err != nil {
		fmt.Printf("❌ Failed to request license: %v\n", err)
		return
	}

	fmt.Println("✅ License requested successfully!")
	fmt.Println("📧 Please check your email for the license file")
	fmt.Println("📎 Once received, use File → Import License to activate")
}

// User imports a license file
func (app *Application) OnImportLicense(filePath string) {
	fmt.Printf("\n📎 Importing license from: %s\n", filePath)

	err := app.licenseClient.ImportLicenseFile(filePath)
	if err != nil {
		fmt.Printf("❌ Failed to import license: %v\n", err)
		return
	}

	fmt.Println("✅ License imported successfully!")
	fmt.Println("🔄 Restarting application to apply license...")

	// Restart to apply new license
	app.StartupCheck()
}

// User requests extension
func (app *Application) OnRequestExtension() {
	fmt.Println("\n📝 Requesting License Extension...")

	license, err := app.licenseClient.LoadLicense()
	if err != nil {
		fmt.Println("❌ No license found")
		return
	}

	// In a real app, this would be a form dialog
	err = app.licenseClient.RequestExtension(
		license.LicenseID,
		license.Email,
		3, // Request 3 months
		"Need more time for POC completion",
	)

	if err != nil {
		fmt.Printf("❌ Failed to request extension: %v\n", err)
		return
	}

	fmt.Println("✅ Extension requested successfully!")
	fmt.Println("⏳ Waiting for admin approval...")
	fmt.Println("📧 You'll receive the extended license via email once approved")
}

// Periodic license checks (every hour)
func (app *Application) periodicLicenseCheck() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		status, license, _ := app.licenseClient.GetLicenseStatus()

		// Check if status changed
		if status != app.currentStatus {
			fmt.Printf("\n⚠️  License status changed: %s → %s\n",
				app.currentStatus, status)
			app.currentStatus = status

			// React to status change
			switch status {
			case client.StatusExpiringSoon:
				days := int(license.ValidUntil.Sub(time.Now()).Hours() / 24)
				app.showExpiryWarning(days)

			case client.StatusExpired:
				app.showExpiredDialog()
				app.startFreeMode()

			case client.StatusRevoked:
				fmt.Println("🚫 Your license has been revoked")
				app.startFreeMode()
			}
		}

		// Check revocation list
		if license != nil {
			revoked, _ := app.licenseClient.CheckRevocation(license.LicenseID)
			if revoked {
				fmt.Println("🚫 License revoked by administrator")
				app.startFreeMode()
			}
		}
	}
}

// UI Helper functions
func (app *Application) showUpgradeButton() {
	fmt.Println("\n╔════════════════════════════════╗")
	fmt.Println("║   🎯 Upgrade to Trial License   ║")
	fmt.Println("║  Get 30 days of full features!  ║")
	fmt.Println("╚════════════════════════════════╝")
}

func (app *Application) showExpiryWarning(days int) {
	fmt.Printf("\n⚠️  WARNING: License expires in %d days\n", days)
	fmt.Println("Click 'Request Extension' to continue using full features")
}

func (app *Application) showGracePeriodWarning() {
	fmt.Println("\n⚠️  GRACE PERIOD: License has expired")
	fmt.Println("You have 7 days to request an extension")
	fmt.Println("After that, the app will revert to FREE mode")
}

func (app *Application) showExpiredDialog() {
	fmt.Println("\n╔════════════════════════════════╗")
	fmt.Println("║      ❌ License Expired         ║")
	fmt.Println("║   Request Extension or Run Free ║")
	fmt.Println("╚════════════════════════════════╝")
}

func (app *Application) resetApplication() {
	fmt.Println("🔄 Resetting application state...")
	fmt.Println("📊 Clearing dashboards...")
	fmt.Println("🔔 Clearing alerts...")
	fmt.Println("📈 Clearing reports...")
	fmt.Println("✅ Reset complete - Starting fresh")

	// Restart in free mode
	app.startFreeMode()
}

// Main function
func main() {
	app := NewApplication()

	// Simulate application startup
	app.StartupCheck()

	// Simulate user interactions (in a real app, these would be UI events)
	fmt.Println("\n--- Demo Interactions ---")
	fmt.Println("1. Request Trial License")
	fmt.Println("2. Import License File")
	fmt.Println("3. Request Extension")
	fmt.Println("4. Exit")

	// Keep the demo running
	select {}
}