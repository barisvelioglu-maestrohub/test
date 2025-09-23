package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"net/smtp"
	"time"

	"github.com/google/uuid"
	"github.com/jordan-wright/email"
	"github.com/maestrohub/license-server/internal/config"
	"github.com/maestrohub/license-server/internal/repository"
	"github.com/maestrohub/license-server/pkg/models"
)

type EmailService interface {
	SendLicense(to string, license *models.License, magicLink string) error
	SendExtension(to string, license *models.License) error
	SendExpiryWarning(to string, license *models.License, daysRemaining int) error
	SendRevoked(to string, license *models.License, reason string) error
	SendMagicLink(to string, data MagicLinkData) error
}

type MagicLinkData struct {
	CustomerName string
	MagicLink    string
	ExpiresIn    string
}

type emailService struct {
	config       *config.EmailConfig
	db           *repository.Database
	fromEmail    string
	fromName     string
	smtpAuth     smtp.Auth
	smtpAddr     string
}

func NewEmailService(cfg *config.EmailConfig, db *repository.Database) EmailService {
	var auth smtp.Auth
	addr := ""

	if cfg.Provider == "smtp" && cfg.SMTPHost != "" {
		auth = smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPHost)
		addr = fmt.Sprintf("%s:%d", cfg.SMTPHost, cfg.SMTPPort)
	}

	return &emailService{
		config:    cfg,
		db:        db,
		fromEmail: cfg.FromEmail,
		fromName:  cfg.FromName,
		smtpAuth:  auth,
		smtpAddr:  addr,
	}
}

func (s *emailService) SendLicense(to string, license *models.License, magicLink string) error {
	subject := fmt.Sprintf("Your %s License", license.Product)

	licenseJSON, err := json.MarshalIndent(license, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal license: %w", err)
	}

	body := s.renderTemplate("license", map[string]interface{}{
		"Product":    license.Product,
		"LicenseID":  license.LicenseID,
		"ValidFrom":  license.ValidFrom.Format("January 2, 2006"),
		"ValidUntil": s.formatValidUntil(license),
		"MagicLink":  magicLink,
	})

	e := &email.Email{
		From:    fmt.Sprintf("%s <%s>", s.fromName, s.fromEmail),
		To:      []string{to},
		Subject: subject,
		HTML:    []byte(body),
		Attachments: []*email.Attachment{
			{
				Filename: fmt.Sprintf("license-%s.json", license.LicenseID),
				Content:  licenseJSON,
			},
		},
	}

	if err := s.send(e); err != nil {
		return err
	}

	return s.recordEmail(license.LicenseID, to, "new_license", "sent")
}

func (s *emailService) SendExtension(to string, license *models.License) error {
	subject := fmt.Sprintf("License Extended - %s", license.Product)

	body := s.renderTemplate("extension", map[string]interface{}{
		"Product":       license.Product,
		"LicenseID":     license.LicenseID,
		"NewValidUntil": s.formatValidUntil(license),
	})

	e := &email.Email{
		From:    fmt.Sprintf("%s <%s>", s.fromName, s.fromEmail),
		To:      []string{to},
		Subject: subject,
		HTML:    []byte(body),
	}

	if err := s.send(e); err != nil {
		return err
	}

	return s.recordEmail(license.LicenseID, to, "extension", "sent")
}

func (s *emailService) SendExpiryWarning(to string, license *models.License, daysRemaining int) error {
	subject := fmt.Sprintf("License Expiring Soon - %s", license.Product)

	body := s.renderTemplate("expiry_warning", map[string]interface{}{
		"Product":       license.Product,
		"LicenseID":     license.LicenseID,
		"DaysRemaining": daysRemaining,
		"ExpiryDate":    s.formatValidUntil(license),
	})

	e := &email.Email{
		From:    fmt.Sprintf("%s <%s>", s.fromName, s.fromEmail),
		To:      []string{to},
		Subject: subject,
		HTML:    []byte(body),
	}

	if err := s.send(e); err != nil {
		return err
	}

	return s.recordEmail(license.LicenseID, to, fmt.Sprintf("expiry_warning_%d", daysRemaining), "sent")
}

func (s *emailService) SendRevoked(to string, license *models.License, reason string) error {
	subject := fmt.Sprintf("License Revoked - %s", license.Product)

	body := s.renderTemplate("revoked", map[string]interface{}{
		"Product":   license.Product,
		"LicenseID": license.LicenseID,
		"Reason":    reason,
	})

	e := &email.Email{
		From:    fmt.Sprintf("%s <%s>", s.fromName, s.fromEmail),
		To:      []string{to},
		Subject: subject,
		HTML:    []byte(body),
	}

	if err := s.send(e); err != nil {
		return err
	}

	return s.recordEmail(license.LicenseID, to, "revoked", "sent")
}

func (s *emailService) SendMagicLink(to string, data MagicLinkData) error {
	subject := "Access Your License Portal"

	body := s.renderTemplate("magic_link", map[string]interface{}{
		"CustomerName": data.CustomerName,
		"MagicLink":    data.MagicLink,
		"ExpiresIn":    data.ExpiresIn,
	})

	e := &email.Email{
		From:    fmt.Sprintf("%s <%s>", s.fromName, s.fromEmail),
		To:      []string{to},
		Subject: subject,
		HTML:    []byte(body),
	}

	return s.send(e)
}

func (s *emailService) send(e *email.Email) error {
	if s.config.Provider == "smtp" && s.smtpAddr != "" {
		return e.Send(s.smtpAddr, s.smtpAuth)
	}

	fmt.Printf("Email would be sent to: %v\nSubject: %s\n", e.To, e.Subject)
	return nil
}

func (s *emailService) recordEmail(licenseID, to, template, status string) error {
	record := &models.EmailRecord{
		ID:        uuid.New().String(),
		LicenseID: licenseID,
		ToEmail:   to,
		Template:  template,
		Status:    status,
		CreatedAt: time.Now(),
	}

	query := `
		INSERT INTO emails (id, license_id, to_email, template, status, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`

	_, err := s.db.Exec(query, record.ID, record.LicenseID, record.ToEmail,
		record.Template, record.Status, record.CreatedAt)

	return err
}

func (s *emailService) formatValidUntil(license *models.License) string {
	if license.Lifetime {
		return "Lifetime"
	}
	if license.ValidUntil != nil {
		return license.ValidUntil.Format("January 2, 2006")
	}
	return "N/A"
}

func (s *emailService) renderTemplate(name string, data interface{}) string {
	tmpl := getTemplate(name)
	var buf bytes.Buffer
	t, _ := template.New(name).Parse(tmpl)
	t.Execute(&buf, data)
	return buf.String()
}

func getTemplate(name string) string {
	templates := map[string]string{
		"license": `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .info { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .button { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Your {{.Product}} License</h1>
    <div class="info">
        <p><strong>License ID:</strong> {{.LicenseID}}</p>
        <p><strong>Valid From:</strong> {{.ValidFrom}}</p>
        <p><strong>Valid Until:</strong> {{.ValidUntil}}</p>
    </div>
    <p>Your license file is attached to this email. Please save it in a secure location.</p>
    <p><a href="{{.MagicLink}}" class="button">Access Portal</a></p>
</body>
</html>`,
		"extension": `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .info { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>License Extended</h1>
    <div class="info">
        <p><strong>Product:</strong> {{.Product}}</p>
        <p><strong>License ID:</strong> {{.LicenseID}}</p>
        <p><strong>New Expiry Date:</strong> {{.NewValidUntil}}</p>
    </div>
    <p>Your license has been successfully extended.</p>
</body>
</html>`,
		"expiry_warning": `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #d9534f; }
        .warning { background: #fcf8e3; border: 1px solid #faebcc; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>License Expiring Soon</h1>
    <div class="warning">
        <p><strong>Product:</strong> {{.Product}}</p>
        <p><strong>License ID:</strong> {{.LicenseID}}</p>
        <p><strong>Days Remaining:</strong> {{.DaysRemaining}}</p>
        <p><strong>Expiry Date:</strong> {{.ExpiryDate}}</p>
    </div>
    <p>Please contact your administrator to request an extension.</p>
</body>
</html>`,
		"revoked": `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #d9534f; }
        .alert { background: #f2dede; border: 1px solid #ebccd1; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>License Revoked</h1>
    <div class="alert">
        <p><strong>Product:</strong> {{.Product}}</p>
        <p><strong>License ID:</strong> {{.LicenseID}}</p>
        <p><strong>Reason:</strong> {{.Reason}}</p>
    </div>
    <p>Your license has been revoked. Please contact support if you believe this is an error.</p>
</body>
</html>`,
		"magic_link": `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .button { display: inline-block; padding: 12px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; font-size: 16px; }
        .info { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>Access Your License Portal</h1>
    <p>Hello {{.CustomerName}},</p>
    <p>Click the button below to access your license portal:</p>
    <div style="text-align: center; margin: 30px 0;">
        <a href="{{.MagicLink}}" class="button">Access Portal</a>
    </div>
    <div class="info">
        <p><small>This link expires in {{.ExpiresIn}}. If you didn't request this, please ignore this email.</small></p>
    </div>
</body>
</html>`,
	}

	if tmpl, ok := templates[name]; ok {
		return tmpl
	}
	return ""
}