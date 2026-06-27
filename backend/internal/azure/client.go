package azure

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"aegisai-x/internal/database/postgres"
	"aegisai-x/internal/utils"
)

type AzureClient struct {
	Connected      bool
	SubscriptionID string
	Subscription   string
	LastError      string
	LastUpdated    time.Time
}

var (
	clientInstance *AzureClient
	clientMu       sync.RWMutex
)

func GetClient() *AzureClient {
	clientMu.RLock()
	defer clientMu.RUnlock()
	return clientInstance
}

// GetAZPath returns the path to the azure cli executable, looking in common paths on Windows
func GetAZPath() string {
	path, err := exec.LookPath("az")
	if err == nil {
		return path
	}

	// Fallback for Windows where the PATH is not updated in the current running process
	commonPaths := []string{
		`C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin\az.cmd`,
		`C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin\az.bat`,
		`C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin\az`,
		`C:\Program Files (x86)\Microsoft SDKs\Azure\CLI2\wbin\az.exe`,
	}

	for _, p := range commonPaths {
		info, err := os.Stat(p)
		if err == nil && !info.IsDir() {
			return p
		}
	}

	return "az"
}

func InitClient(ctx context.Context) {
	clientMu.Lock()
	defer clientMu.Unlock()

	log.Println("[Azure] Initializing Azure authentication...")

	clientInstance = &AzureClient{
		LastUpdated: time.Now(),
	}

	// Try loading from database first
	var credsStr, connStatus, connType string
	if postgres.DB != nil {
		err := postgres.DB.QueryRowContext(ctx, "SELECT encrypted_credentials, status, connection_type FROM cloud_connections WHERE provider = 'azure'").Scan(&credsStr, &connStatus, &connType)
		if err == nil && connStatus == "connected" {
			if connType == "service-principal" && credsStr != "" {
				decrypted, errDec := utils.Decrypt(credsStr)
				if errDec == nil {
					var creds struct {
						TenantID       string `json:"tenantId"`
						ClientID       string `json:"clientId"`
						ClientSecret   string `json:"clientSecret"`
						SubscriptionID string `json:"subscriptionId"`
					}
					if json.Unmarshal([]byte(decrypted), &creds) == nil && creds.ClientID != "" {
						os.Setenv("AZURE_CLIENT_ID", creds.ClientID)
						os.Setenv("AZURE_CLIENT_SECRET", creds.ClientSecret)
						os.Setenv("AZURE_TENANT_ID", creds.TenantID)
						os.Setenv("AZURE_SUBSCRIPTION_ID", creds.SubscriptionID)
					}
				}
			} else if connType == "cli-login" {
				os.Unsetenv("AZURE_CLIENT_ID")
				os.Unsetenv("AZURE_CLIENT_SECRET")
				os.Unsetenv("AZURE_TENANT_ID")
				os.Unsetenv("AZURE_SUBSCRIPTION_ID")
			}
		}
	}

	log.Println("[Azure] Attempting Service Principal authentication...")
	if CheckServicePrincipalAuth() {
		clientInstance.Connected = true
		clientInstance.SubscriptionID = os.Getenv("AZURE_SUBSCRIPTION_ID")
		clientInstance.Subscription = "Service Principal Subscription"
		log.Println("[Azure] Subscription loaded.")
		log.Println("[Azure] Azure Status = Connected.")
		return
	}

	log.Println("[Azure] Service Principal unavailable.")
	log.Println("[Azure] Attempting Azure CLI authentication...")

	if CheckCLIAuth(ctx) {
		clientInstance.Connected = true
		azPath := GetAZPath()

		cmd := exec.CommandContext(ctx, azPath, "account", "show", "--query", "name", "-o", "tsv")
		out, err := cmd.Output()
		if err == nil {
			clientInstance.Subscription = strings.TrimSpace(string(out))
		} else {
			clientInstance.Subscription = "Azure CLI Subscription"
		}

		cmdID := exec.CommandContext(ctx, azPath, "account", "show", "--query", "id", "-o", "tsv")
		outID, errID := cmdID.Output()
		if errID == nil {
			clientInstance.SubscriptionID = strings.TrimSpace(string(outID))
		}
		log.Println("[Azure] Azure CLI session detected.")
		log.Println("[Azure] Subscription loaded.")
		log.Println("[Azure] Azure Status = Connected.")
		return
	}

	clientInstance.Connected = false
	clientInstance.LastError = "Authentication credentials unavailable. No active Azure CLI session ('az login' not run) or Service Principal variables (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID) not found."
	log.Println("[Azure] Authentication unavailable.")
	log.Println("[Azure] Entering Degraded Mode.")
}
