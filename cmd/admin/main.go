package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"syscall"
	"time"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"

	"github.com/maestrohub/license-server/internal/config"
	"github.com/maestrohub/license-server/internal/repository"
)

func main() {
	var (
		configPath string
		email      string
		name       string
		password   string
	)

	flag.StringVar(&configPath, "config", "", "Path to config file")
	flag.StringVar(&email, "email", "", "Admin email address")
	flag.StringVar(&name, "name", "", "Admin name")
	flag.StringVar(&password, "password", "", "Admin password (leave empty for prompt)")
	flag.Parse()

	if email == "" || name == "" {
		fmt.Println("Usage: admin-init -email admin@company.com -name 'Admin Name' [-password password]")
		os.Exit(1)
	}

	// Load config
	cfg, err := config.Load(configPath)
	if err != nil {
		log.Fatal("Failed to load config:", err)
	}

	// Connect to database
	db, err := repository.NewDatabase(&cfg.Database)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer db.Close()

	// Run migrations first
	if err := db.Migrate(); err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// Check if admin already exists
	var count int
	countQuery := `SELECT COUNT(*) FROM admin_users`
	err = db.Get(&count, countQuery)
	if err != nil {
		log.Fatal("Failed to check admin users:", err)
	}

	if count > 0 {
		fmt.Println("Admin user already exists!")
		fmt.Println("Use the web interface to create additional admin users.")
		os.Exit(1)
	}

	// Get password if not provided
	if password == "" {
		fmt.Print("Enter admin password: ")
		bytePassword, err := term.ReadPassword(int(syscall.Stdin))
		if err != nil {
			log.Fatal("Failed to read password:", err)
		}
		password = string(bytePassword)
		fmt.Println()

		fmt.Print("Confirm password: ")
		byteConfirm, err := term.ReadPassword(int(syscall.Stdin))
		if err != nil {
			log.Fatal("Failed to read password:", err)
		}
		fmt.Println()

		if string(byteConfirm) != password {
			log.Fatal("Passwords do not match!")
		}
	}

	// Validate password strength
	if len(password) < 8 {
		log.Fatal("Password must be at least 8 characters long")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal("Failed to hash password:", err)
	}

	// Create admin user
	id := "admin_" + generateRandomID()
	query := `
		INSERT INTO admin_users (id, email, name, password_hash, role, active, created_at)
		VALUES (?, ?, ?, ?, 'admin', true, datetime('now'))
	`

	_, err = db.Exec(query, id, email, name, string(hashedPassword))
	if err != nil {
		log.Fatal("Failed to create admin user:", err)
	}

	fmt.Println("\n✅ Admin user created successfully!")
	fmt.Printf("Email: %s\n", email)
	fmt.Printf("Name: %s\n", name)
	fmt.Printf("ID: %s\n", id)
	fmt.Println("\nYou can now login at: http://localhost:8080/api/v1/auth/login")
	fmt.Println("\nIMPORTANT: Store your password securely. You won't be able to recover it!")
}

func generateRandomID() string {
	// Simple ID generation
	return fmt.Sprintf("%d", time.Now().Unix())
}