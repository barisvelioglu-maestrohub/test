package crypto

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"sort"
	"time"

	"github.com/maestrohub/license-server/pkg/models"
)

type Signer interface {
	SignLicense(license *models.License) error
	VerifyLicense(license *models.License) error
	GenerateKeyPair() (*KeyPair, error)
	GetPublicKeyJWK(kid string) (map[string]interface{}, error)
}

type KeyPair struct {
	KID        string
	PublicKey  ed25519.PublicKey
	PrivateKey ed25519.PrivateKey
	Algorithm  string
	CreatedAt  time.Time
}

type Ed25519Signer struct {
	keys map[string]*KeyPair
	activeKID string
}

func NewEd25519Signer() *Ed25519Signer {
	return &Ed25519Signer{
		keys: make(map[string]*KeyPair),
	}
}

func (s *Ed25519Signer) GenerateKeyPair() (*KeyPair, error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate key pair: %w", err)
	}

	kid := fmt.Sprintf("%s-ed25519-%02d",
		time.Now().Format("2006-01"),
		len(s.keys)+1)

	kp := &KeyPair{
		KID:        kid,
		PublicKey:  pub,
		PrivateKey: priv,
		Algorithm:  "ed25519",
		CreatedAt:  time.Now(),
	}

	s.keys[kid] = kp
	if s.activeKID == "" {
		s.activeKID = kid
	}

	return kp, nil
}

func (s *Ed25519Signer) AddKeyPair(kp *KeyPair) {
	s.keys[kp.KID] = kp
	if s.activeKID == "" {
		s.activeKID = kp.KID
	}
}

func (s *Ed25519Signer) SetActiveKey(kid string) error {
	if _, exists := s.keys[kid]; !exists {
		return fmt.Errorf("key with kid %s not found", kid)
	}
	s.activeKID = kid
	return nil
}

func (s *Ed25519Signer) SignLicense(license *models.License) error {
	if s.activeKID == "" {
		return fmt.Errorf("no active signing key")
	}

	kp, exists := s.keys[s.activeKID]
	if !exists {
		return fmt.Errorf("active key not found")
	}

	license.KID = kp.KID
	license.SigAlg = kp.Algorithm

	canonical, err := canonicalizeJSON(license)
	if err != nil {
		return fmt.Errorf("failed to canonicalize license: %w", err)
	}

	signature := ed25519.Sign(kp.PrivateKey, canonical)
	license.SignatureB64 = base64.StdEncoding.EncodeToString(signature)

	return nil
}

func (s *Ed25519Signer) VerifyLicense(license *models.License) error {
	kp, exists := s.keys[license.KID]
	if !exists {
		return fmt.Errorf("key with kid %s not found", license.KID)
	}

	if license.SigAlg != "ed25519" {
		return fmt.Errorf("unsupported algorithm: %s", license.SigAlg)
	}

	sig, err := base64.StdEncoding.DecodeString(license.SignatureB64)
	if err != nil {
		return fmt.Errorf("invalid signature encoding: %w", err)
	}

	tempSig := license.SignatureB64
	license.SignatureB64 = ""
	defer func() { license.SignatureB64 = tempSig }()

	canonical, err := canonicalizeJSON(license)
	if err != nil {
		return fmt.Errorf("failed to canonicalize license: %w", err)
	}

	if !ed25519.Verify(kp.PublicKey, canonical, sig) {
		return fmt.Errorf("signature verification failed")
	}

	return nil
}

func (s *Ed25519Signer) GetPublicKeyJWK(kid string) (map[string]interface{}, error) {
	kp, exists := s.keys[kid]
	if !exists {
		return nil, fmt.Errorf("key not found")
	}

	pubKeyB64 := base64.RawURLEncoding.EncodeToString(kp.PublicKey)

	jwk := map[string]interface{}{
		"kty": "OKP",
		"crv": "Ed25519",
		"kid": kp.KID,
		"x":   pubKeyB64,
		"use": "sig",
		"alg": "EdDSA",
	}

	return jwk, nil
}

func (s *Ed25519Signer) ExportPublicKey(kid string) (string, error) {
	kp, exists := s.keys[kid]
	if !exists {
		return "", fmt.Errorf("key not found")
	}

	pubKeyBytes, err := x509.MarshalPKIXPublicKey(kp.PublicKey)
	if err != nil {
		return "", err
	}

	pubPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubKeyBytes,
	})

	return string(pubPEM), nil
}

func (s *Ed25519Signer) ExportPrivateKey(kid string) (string, error) {
	kp, exists := s.keys[kid]
	if !exists {
		return "", fmt.Errorf("key not found")
	}

	privKeyBytes, err := x509.MarshalPKCS8PrivateKey(kp.PrivateKey)
	if err != nil {
		return "", err
	}

	privPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: privKeyBytes,
	})

	return string(privPEM), nil
}

func canonicalizeJSON(license *models.License) ([]byte, error) {
	tempSig := license.SignatureB64
	license.SignatureB64 = ""
	defer func() { license.SignatureB64 = tempSig }()

	data := map[string]interface{}{
		"schema_version": license.SchemaVersion,
		"license_id":     license.LicenseID,
		"customer_id":    license.CustomerID,
		"product":        license.Product,
		"valid_from":     license.ValidFrom.Format(time.RFC3339),
		"lifetime":       license.Lifetime,
		"features":       canonicalizeMap(license.Features),
		"seats":          license.Seats,
		"notes":          license.Notes,
		"kid":            license.KID,
		"sig_alg":        license.SigAlg,
	}

	if license.ValidUntil != nil && !license.Lifetime {
		data["valid_until"] = license.ValidUntil.Format(time.RFC3339)
	}

	return json.Marshal(data)
}

func canonicalizeMap(m map[string]interface{}) map[string]interface{} {
	if m == nil {
		return nil
	}

	result := make(map[string]interface{})
	keys := make([]string, 0, len(m))

	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, k := range keys {
		v := m[k]
		switch val := v.(type) {
		case map[string]interface{}:
			result[k] = canonicalizeMap(val)
		default:
			result[k] = val
		}
	}

	return result
}

func ParseKeyPair(publicPEM, privatePEM string, kid string) (*KeyPair, error) {
	pubBlock, _ := pem.Decode([]byte(publicPEM))
	if pubBlock == nil {
		return nil, fmt.Errorf("failed to parse public key PEM")
	}

	pubKey, err := x509.ParsePKIXPublicKey(pubBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse public key: %w", err)
	}

	ed25519PubKey, ok := pubKey.(ed25519.PublicKey)
	if !ok {
		return nil, fmt.Errorf("not an ed25519 public key")
	}

	privBlock, _ := pem.Decode([]byte(privatePEM))
	if privBlock == nil {
		return nil, fmt.Errorf("failed to parse private key PEM")
	}

	privKey, err := x509.ParsePKCS8PrivateKey(privBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	ed25519PrivKey, ok := privKey.(ed25519.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("not an ed25519 private key")
	}

	return &KeyPair{
		KID:        kid,
		PublicKey:  ed25519PubKey,
		PrivateKey: ed25519PrivKey,
		Algorithm:  "ed25519",
		CreatedAt:  time.Now(),
	}, nil
}

