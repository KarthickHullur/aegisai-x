package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"aegisai-x/internal/cloud"
	"aegisai-x/internal/database/postgres"
	"aegisai-x/internal/utils"

	"github.com/gin-gonic/gin"
)

type ConnectionResponseItem struct {
	Provider       string                 `json:"provider"`
	ConnectionType string                 `json:"connectionType"`
	Status         string                 `json:"status"`
	LastSync       string                 `json:"lastSync,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
}

// GetCloudConnections handles GET /cloud-connections
func GetCloudConnections(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT provider, connection_type, status, last_sync, metadata FROM cloud_connections")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	// Initialize mapping with default disconnected state for all 4 providers
	providers := map[string]ConnectionResponseItem{
		"docker":     {Provider: "docker", ConnectionType: "Docker Endpoint", Status: "disconnected"},
		"kubernetes": {Provider: "kubernetes", ConnectionType: "kubeconfig", Status: "disconnected"},
		"azure":      {Provider: "azure", ConnectionType: "cli-login", Status: "disconnected"},
		"aws":        {Provider: "aws", ConnectionType: "cli-login", Status: "disconnected"},
	}

	for rows.Next() {
		var provider, connType, status string
		var lastSync time.Time
		var metadataStr string

		if err := rows.Scan(&provider, &connType, &status, &lastSync, &metadataStr); err == nil {
			var metadata map[string]interface{}
			_ = json.Unmarshal([]byte(metadataStr), &metadata)

			providers[provider] = ConnectionResponseItem{
				Provider:       provider,
				ConnectionType: connType,
				Status:         status,
				LastSync:       lastSync.Format(time.RFC3339),
				Metadata:       metadata,
			}
		}
	}

	var list []ConnectionResponseItem
	for _, item := range providers {
		list = append(list, item)
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

// ConnectRequest represents request for connecting provider
type ConnectRequest struct {
	Provider       string `json:"provider" binding:"required"`
	ConnectionType string `json:"connectionType" binding:"required"`
	Credentials    string `json:"credentials" binding:"required"` // raw json credentials string
}

// ConnectCloudConnection handles POST /cloud-connections/connect
func ConnectCloudConnection(c *gin.Context) {
	c.Header("Content-Type", "application/json")
	var req ConnectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 120*time.Second)
	defer cancel()

	err := cloud.Connect(ctx, postgres.DB, req.Provider, req.ConnectionType, req.Credentials)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Connection established and saved successfully"})
}

// TestRequest represents request for testing connection
type TestRequest struct {
	Provider       string `json:"provider" binding:"required"`
	ConnectionType string `json:"connectionType" binding:"required"`
	Credentials    string `json:"credentials" binding:"required"`
}

// TestCloudConnection handles POST /cloud-connections/test
func TestCloudConnection(c *gin.Context) {
	c.Header("Content-Type", "application/json")
	var req TestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success":   false,
			"provider":  "",
			"connected": false,
			"message":   "Invalid request body",
			"error":     err.Error(),
		})
		return
	}

	// 7. Add diagnostics logging
	switch req.Provider {
	case "docker":
		log.Println("[Connections] Testing Docker...")
	case "kubernetes":
		log.Println("[Connections] Testing Kubernetes...")
	case "azure":
		log.Println("[Connections] Testing Azure...")
	case "aws":
		log.Println("[Connections] Testing AWS...")
	default:
		log.Printf("[Connections] Testing %s...", req.Provider)
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	success, msg, details, err := cloud.TestConnection(ctx, req.Provider, req.ConnectionType, req.Credentials)
	if details == nil {
		details = make(map[string]interface{})
	}

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":   false,
			"provider":  req.Provider,
			"connected": false,
			"message":   msg,
			"error":     err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   success,
		"provider":  req.Provider,
		"connected": success,
		"message":   msg,
		"metadata":  details,
	})
}

// DisconnectRequest represents request for disconnecting
type DisconnectRequest struct {
	Provider string `json:"provider" binding:"required"`
}

// DisconnectCloudConnection handles POST /cloud-connections/disconnect
func DisconnectCloudConnection(c *gin.Context) {
	var req DisconnectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	err := cloud.Disconnect(ctx, postgres.DB, req.Provider)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Provider disconnected successfully"})
}

// GetSystemMode handles GET /system/mode
func GetSystemMode(c *gin.Context) {
	var mode string
	err := postgres.DB.QueryRow("SELECT value FROM platform_settings WHERE key = 'system_mode'").Scan(&mode)
	if err != nil {
		mode = "DEMO"
	}

	var hasCredentials bool
	var count int
	_ = postgres.DB.QueryRow("SELECT COUNT(*) FROM cloud_connections WHERE status = 'connected'").Scan(&count)
	hasCredentials = count > 0

	c.JSON(http.StatusOK, gin.H{
		"mode":           mode,
		"hasCredentials": hasCredentials,
	})
}

// UpdateModeRequest represents request for toggling mode
type UpdateModeRequest struct {
	Mode string `json:"mode" binding:"required"` // "LIVE" or "DEMO"
}

// UpdateSystemMode handles POST /system/mode
func UpdateSystemMode(c *gin.Context) {
	var req UpdateModeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Mode != "LIVE" && req.Mode != "DEMO" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid mode. Must be 'LIVE' or 'DEMO'"})
		return
	}

	if req.Mode == "LIVE" {
		var count int
		_ = postgres.DB.QueryRow("SELECT COUNT(*) FROM cloud_connections WHERE status = 'connected'").Scan(&count)
		if count == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot switch to LIVE mode: No active credentials configured."})
			return
		}
	}

	// Update system mode
	_, err := postgres.DB.Exec("INSERT INTO platform_settings (key, value) VALUES ('system_mode', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", req.Mode)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Trigger immediate config healing/auth load for AWS & Azure if toggling to LIVE
	if req.Mode == "LIVE" {
		// Reload Azure credentials
		var azureCredsStr string
		err := postgres.DB.QueryRow("SELECT encrypted_credentials FROM cloud_connections WHERE provider = 'azure' AND status = 'connected'").Scan(&azureCredsStr)
		if err == nil && azureCredsStr != "" {
			decrypted, errDec := utils.Decrypt(azureCredsStr)
			if errDec == nil {
				var creds cloud.AzureCreds
				if json.Unmarshal([]byte(decrypted), &creds) == nil && creds.ClientID != "" {
					os.Setenv("AZURE_CLIENT_ID", creds.ClientID)
					os.Setenv("AZURE_CLIENT_SECRET", creds.ClientSecret)
					os.Setenv("AZURE_TENANT_ID", creds.TenantID)
					os.Setenv("AZURE_SUBSCRIPTION_ID", creds.SubscriptionID)
				}
			}
		}

		// Reload AWS credentials
		var awsCredsStr string
		err = postgres.DB.QueryRow("SELECT encrypted_credentials FROM cloud_connections WHERE provider = 'aws' AND status = 'connected'").Scan(&awsCredsStr)
		if err == nil && awsCredsStr != "" {
			decrypted, errDec := utils.Decrypt(awsCredsStr)
			if errDec == nil {
				var creds cloud.AWSCreds
				if json.Unmarshal([]byte(decrypted), &creds) == nil && creds.AccessKeyID != "" {
					os.Setenv("AWS_ACCESS_KEY_ID", creds.AccessKeyID)
					os.Setenv("AWS_SECRET_ACCESS_KEY", creds.SecretAccessKey)
					os.Setenv("AWS_DEFAULT_REGION", creds.Region)
					os.Setenv("AWS_REGION", creds.Region)
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "mode": req.Mode})
}

// GetDockerConnectionTest handles GET /api/connections/docker/test
func GetDockerConnectionTest(c *gin.Context) {
	c.Header("Content-Type", "application/json")
	log.Println("[Connections] Testing Docker...")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	var encryptedCreds, connType string
	var credentials string
	err := postgres.DB.QueryRow("SELECT encrypted_credentials, connection_type FROM cloud_connections WHERE provider = 'docker'").Scan(&encryptedCreds, &connType)
	if err == nil && encryptedCreds != "" {
		credentials, _ = utils.Decrypt(encryptedCreds)
	} else {
		credentials = "{}"
		connType = "Docker Endpoint"
	}

	success, msg, details, testErr := cloud.TestConnection(ctx, "docker", connType, credentials)
	if details == nil {
		details = make(map[string]interface{})
	}

	if testErr != nil || !success {
		c.JSON(http.StatusOK, gin.H{
			"success":   false,
			"provider":  "docker",
			"connected": false,
			"message":   "Docker daemon unavailable",
			"error":     func() string {
				if testErr != nil {
					return testErr.Error()
				}
				return msg
			}(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"provider":  "docker",
		"connected": true,
		"message":   msg,
		"metadata":  details,
	})
}

// GetK8sConnectionTest handles GET /api/connections/kubernetes/test
func GetK8sConnectionTest(c *gin.Context) {
	c.Header("Content-Type", "application/json")
	log.Println("[Connections] Testing Kubernetes...")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	var encryptedCreds, connType string
	var credentials string
	err := postgres.DB.QueryRow("SELECT encrypted_credentials, connection_type FROM cloud_connections WHERE provider = 'kubernetes'").Scan(&encryptedCreds, &connType)
	if err == nil && encryptedCreds != "" {
		credentials, _ = utils.Decrypt(encryptedCreds)
	} else {
		kubeconfigPath := os.Getenv("KUBECONFIG")
		if kubeconfigPath == "" {
			homeDir, _ := os.UserHomeDir()
			if homeDir != "" {
				kubeconfigPath = filepath.Join(homeDir, ".kube", "config")
			}
		}
		if kubeconfigPath != "" {
			if data, err := os.ReadFile(kubeconfigPath); err == nil {
				credentials = string(data)
			}
		}
	}

	if credentials == "" {
		c.JSON(http.StatusOK, gin.H{
			"success":   false,
			"provider":  "kubernetes",
			"connected": false,
			"message":   "Kubernetes authentication unavailable",
			"error":     "No kubeconfig found in database or locally",
		})
		return
	}

	var credsJSON string
	if json.Valid([]byte(credentials)) {
		credsJSON = credentials
	} else {
		credsJSON = fmt.Sprintf(`{"kubeconfig":%q}`, credentials)
	}

	success, msg, details, testErr := cloud.TestConnection(ctx, "kubernetes", "kubeconfig", credsJSON)
	if details == nil {
		details = make(map[string]interface{})
	}

	if testErr != nil || !success {
		c.JSON(http.StatusOK, gin.H{
			"success":   false,
			"provider":  "kubernetes",
			"connected": false,
			"message":   "Kubernetes authentication unavailable",
			"error":     func() string {
				if testErr != nil {
					return testErr.Error()
				}
				return msg
			}(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"provider":  "kubernetes",
		"connected": true,
		"message":   msg,
		"metadata":  details,
	})
}

// GetAzureConnectionTest handles GET /api/connections/azure/test
func GetAzureConnectionTest(c *gin.Context) {
	c.Header("Content-Type", "application/json")
	log.Println("[Connections] Testing Azure...")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	var encryptedCreds, connType string
	err := postgres.DB.QueryRow("SELECT encrypted_credentials, connection_type FROM cloud_connections WHERE provider = 'azure'").Scan(&encryptedCreds, &connType)
	if err == nil && encryptedCreds != "" {
		creds, decErr := utils.Decrypt(encryptedCreds)
		if decErr == nil {
			success, msg, details, testErr := cloud.TestConnection(ctx, "azure", connType, creds)
			if details == nil {
				details = make(map[string]interface{})
			}
			if testErr == nil && success {
				c.JSON(http.StatusOK, gin.H{
					"success":   true,
					"provider":  "azure",
					"connected": true,
					"message":   msg,
					"metadata":  details,
				})
				return
			}
		}
	}

	azPath := cloud.GetAZPath()
	cmd := exec.CommandContext(ctx, azPath, "account", "show", "--query", "name", "-o", "tsv")
	out, err := cmd.Output()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":   false,
			"provider":  "azure",
			"connected": false,
			"message":   "Azure authentication unavailable",
			"error":     err.Error(),
		})
		return
	}

	subName := strings.TrimSpace(string(out))
	cmdID := exec.CommandContext(ctx, azPath, "account", "show", "--query", "id", "-o", "tsv")
	outID, _ := cmdID.Output()
	subID := strings.TrimSpace(string(outID))

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"provider":  "azure",
		"connected": true,
		"message":   "Azure CLI login detected",
		"metadata": gin.H{
			"subscriptionName": subName,
			"subscriptionId":   subID,
		},
	})
}

// GetAwsConnectionTest handles GET /api/connections/aws/test
func GetAwsConnectionTest(c *gin.Context) {
	c.Header("Content-Type", "application/json")
	log.Println("[Connections] Testing AWS...")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	var encryptedCreds, connType string
	err := postgres.DB.QueryRow("SELECT encrypted_credentials, connection_type FROM cloud_connections WHERE provider = 'aws'").Scan(&encryptedCreds, &connType)
	if err == nil && encryptedCreds != "" {
		creds, decErr := utils.Decrypt(encryptedCreds)
		if decErr == nil {
			success, msg, details, testErr := cloud.TestConnection(ctx, "aws", connType, creds)
			if details == nil {
				details = make(map[string]interface{})
			}
			if testErr == nil && success {
				c.JSON(http.StatusOK, gin.H{
					"success":   true,
					"provider":  "aws",
					"connected": true,
					"message":   msg,
					"metadata":  details,
				})
				return
			}
		}
	}

	awsPath := cloud.GetAWSPath()
	cmd := exec.CommandContext(ctx, awsPath, "sts", "get-caller-identity", "--output", "json")
	out, err := cmd.Output()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success":   false,
			"provider":  "aws",
			"connected": false,
			"message":   "AWS authentication unavailable",
			"error":     err.Error(),
		})
		return
	}

	type STSResponse struct {
		Account string `json:"Account"`
		Arn     string `json:"Arn"`
	}
	var sts STSResponse
	_ = json.Unmarshal(out, &sts)

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"provider":  "aws",
		"connected": true,
		"message":   "AWS CLI authentication successful",
		"metadata": gin.H{
			"accountId":      sts.Account,
			"authentication": "AWS CLI",
		},
	})
}

func getStatusHelper(c *gin.Context, provider string) {
	c.Header("Content-Type", "application/json")
	var status string
	err := postgres.DB.QueryRow("SELECT status FROM cloud_connections WHERE provider = $1", provider).Scan(&status)
	if err != nil || status != "connected" {
		c.JSON(http.StatusOK, gin.H{
			"provider":  provider,
			"status":    "disconnected",
			"connected": false,
			"message":   provider + " is not connected",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"provider":  provider,
		"status":    "connected",
		"connected": true,
		"message":   provider + " is connected",
	})
}

// GetDockerConnectionStatus handles GET /api/connections/docker/status
func GetDockerConnectionStatus(c *gin.Context) {
	getStatusHelper(c, "docker")
}

// GetK8sConnectionStatus handles GET /api/connections/kubernetes/status
func GetK8sConnectionStatus(c *gin.Context) {
	getStatusHelper(c, "kubernetes")
}

// GetAzureConnectionStatus handles GET /api/connections/azure/status
func GetAzureConnectionStatus(c *gin.Context) {
	getStatusHelper(c, "azure")
}

// GetAwsConnectionStatus handles GET /api/connections/aws/status
func GetAwsConnectionStatus(c *gin.Context) {
	getStatusHelper(c, "aws")
}
