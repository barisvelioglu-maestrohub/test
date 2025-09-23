package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/maestrohub/license-server/internal/service"
	"github.com/maestrohub/license-server/pkg/models"
)

type Client struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

func NewClient(baseURL, apiKey string) *Client {
	return &Client{
		baseURL: baseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *Client) CreateLicense(req *service.CreateLicenseRequest) (*models.License, error) {
	resp, err := c.doRequest("POST", "/api/v1/licenses", req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, c.parseError(resp)
	}

	var result struct {
		LicenseID  string     `json:"license_id"`
		ValidUntil *time.Time `json:"valid_until"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return c.GetLicense(result.LicenseID)
}

func (c *Client) GetLicense(id string) (*models.License, error) {
	resp, err := c.doRequest("GET", fmt.Sprintf("/api/v1/licenses/%s", id), nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.parseError(resp)
	}

	var license models.License
	if err := json.NewDecoder(resp.Body).Decode(&license); err != nil {
		return nil, err
	}

	return &license, nil
}

func (c *Client) ExtendLicense(id string, months int) (*models.License, error) {
	req := map[string]int{"months": months}
	resp, err := c.doRequest("POST", fmt.Sprintf("/api/v1/licenses/%s/extend", id), req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.parseError(resp)
	}

	return c.GetLicense(id)
}

func (c *Client) RevokeLicense(id, reason string) error {
	req := map[string]string{"reason": reason}
	resp, err := c.doRequest("POST", fmt.Sprintf("/api/v1/licenses/%s/revoke", id), req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.parseError(resp)
	}

	return nil
}

func (c *Client) VerifyLicense(license *models.License) (bool, error) {
	resp, err := c.doRequest("POST", "/api/v1/licenses/verify", license)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	var result struct {
		Valid  bool   `json:"valid"`
		Reason string `json:"reason,omitempty"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}

	if !result.Valid && result.Reason != "" {
		return false, fmt.Errorf("verification failed: %s", result.Reason)
	}

	return result.Valid, nil
}

func (c *Client) GetPublicKey() (map[string]interface{}, error) {
	resp, err := c.doRequest("GET", "/.well-known/licensing-public-key", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.parseError(resp)
	}

	var key map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&key); err != nil {
		return nil, err
	}

	return key, nil
}

func (c *Client) GetRevocations() ([]string, error) {
	resp, err := c.doRequest("GET", "/api/v1/revocations", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, c.parseError(resp)
	}

	var result struct {
		UpdatedAt string   `json:"updated_at"`
		Items     []string `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result.Items, nil
}

func (c *Client) CreateRunToken(licenseID, appInstanceID, otc string) (string, time.Time, error) {
	req := map[string]string{
		"license_id":      licenseID,
		"app_instance_id": appInstanceID,
		"otc":             otc,
	}

	resp, err := c.doRequest("POST", "/api/v1/run-tokens", req)
	if err != nil {
		return "", time.Time{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", time.Time{}, c.parseError(resp)
	}

	var result struct {
		TokenJWT  string    `json:"token_jwt"`
		ExpiresAt time.Time `json:"expires_at"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", time.Time{}, err
	}

	return result.TokenJWT, result.ExpiresAt, nil
}

func (c *Client) GenerateOTC(licenseID, appInstanceID string) (string, time.Time, error) {
	req := map[string]string{
		"license_id":      licenseID,
		"app_instance_id": appInstanceID,
	}

	resp, err := c.doRequest("POST", "/api/v1/run-tokens/generate-otc", req)
	if err != nil {
		return "", time.Time{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", time.Time{}, c.parseError(resp)
	}

	var result struct {
		OTC       string    `json:"otc"`
		ExpiresAt time.Time `json:"expires_at"`
		TTL       int       `json:"ttl"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", time.Time{}, err
	}

	return result.OTC, result.ExpiresAt, nil
}

func (c *Client) doRequest(method, path string, body interface{}) (*http.Response, error) {
	url := c.baseURL + path

	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return c.httpClient.Do(req)
}

func (c *Client) parseError(resp *http.Response) error {
	var errResp struct {
		Error string `json:"error"`
		Code  int    `json:"code"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
		return fmt.Errorf("request failed with status %d", resp.StatusCode)
	}

	return fmt.Errorf("%s (code: %d)", errResp.Error, errResp.Code)
}