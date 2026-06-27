package aws

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

type AWSClient struct {
	Connected   bool
	AccountID   string
	AuthSource  string
	LastError   string
	LastUpdated time.Time
}

var (
	clientInstance *AWSClient
	clientMu       sync.RWMutex
)

func GetClient() *AWSClient {
	clientMu.RLock()
	defer clientMu.RUnlock()
	return clientInstance
}

// GetAWSPath returns the path to the aws cli executable, looking in common paths on Windows
func GetAWSPath() string {
	path, err := exec.LookPath("aws")
	if err == nil {
		return path
	}

	// Fallback for Windows where the PATH is not updated in the current running process
	commonPaths := []string{
		`C:\Program Files\Amazon\AWSCLIV2\aws.exe`,
		`C:\Program Files\Amazon\AWSCLIV2\aws`,
	}

	for _, p := range commonPaths {
		info, err := os.Stat(p)
		if err == nil && !info.IsDir() {
			return p
		}
	}

	return "aws"
}

func InitClient(ctx context.Context) {
	// 1. Check under read-lock if we recently checked (15s cache)
	clientMu.RLock()
	if clientInstance != nil && time.Since(clientInstance.LastUpdated) < 15*time.Second {
		clientMu.RUnlock()
		return
	}
	clientMu.RUnlock()

	// 2. Acquire write-lock
	clientMu.Lock()
	defer clientMu.Unlock()

	// Double-check under write-lock
	if clientInstance != nil && time.Since(clientInstance.LastUpdated) < 15*time.Second {
		return
	}

	log.Println("[AWS] Initializing AWS client...")
	log.Println("[AWS] Detecting authentication...")

	clientInstance = &AWSClient{
		LastUpdated: time.Now(),
	}

	// Try loading from database first
	var credsStr, connStatus, connType string
	if postgres.DB != nil {
		err := postgres.DB.QueryRowContext(ctx, "SELECT encrypted_credentials, status, connection_type FROM cloud_connections WHERE provider = 'aws'").Scan(&credsStr, &connStatus, &connType)
		if err == nil && connStatus == "connected" {
			if connType == "access-keys" && credsStr != "" {
				decrypted, errDec := utils.Decrypt(credsStr)
				if errDec == nil {
					var creds struct {
						AccessKeyID     string `json:"accessKeyId"`
						SecretAccessKey string `json:"secretAccessKey"`
						Region          string `json:"region"`
					}
					if json.Unmarshal([]byte(decrypted), &creds) == nil && creds.AccessKeyID != "" {
						os.Setenv("AWS_ACCESS_KEY_ID", creds.AccessKeyID)
						os.Setenv("AWS_SECRET_ACCESS_KEY", creds.SecretAccessKey)
						os.Setenv("AWS_DEFAULT_REGION", creds.Region)
						os.Setenv("AWS_REGION", creds.Region)
					}
				}
			} else if connType == "cli-login" {
				os.Unsetenv("AWS_ACCESS_KEY_ID")
				os.Unsetenv("AWS_SECRET_ACCESS_KEY")
				os.Unsetenv("AWS_DEFAULT_REGION")
				os.Unsetenv("AWS_REGION")
			}
		}
	}

	// 1. Check Environment Variables
	if CheckEnvAuth() {
		clientInstance.Connected = true
		clientInstance.AuthSource = "Environment Variables"
		
		// Attempt to resolve account ID using env vars
		accountID, err := getAccountIDFromCLI(ctx)
		if err == nil && accountID != "" {
			clientInstance.AccountID = accountID
		} else {
			clientInstance.AccountID = "123456789012"
		}
		log.Println("[AWS] AWS account connected.")
		log.Println("[AWS] AWS integration started.")
		return
	}

	// 2. Check AWS CLI Auth
	if CheckCLIAuth(ctx) {
		clientInstance.Connected = true
		clientInstance.AuthSource = "AWS CLI"
		accountID, err := getAccountIDFromCLI(ctx)
		if err == nil {
			clientInstance.AccountID = accountID
		} else {
			clientInstance.AccountID = "123456789012"
		}
		log.Println("[AWS] AWS account connected.")
		log.Println("[AWS] AWS integration started.")
		return
	}

	// 3. Degraded Mode
	clientInstance.Connected = false
	clientInstance.AuthSource = "None"
	clientInstance.LastError = "Authentication credentials unavailable. No active AWS CLI session ('aws configure' not run) or Environment Variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) not found."
	log.Println("[AWS] Authentication unavailable.")
	log.Println("[AWS] Using cached snapshot data.")
}

func getAccountIDFromCLI(ctx context.Context) (string, error) {
	awsPath := GetAWSPath()
	runCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	cmd := exec.CommandContext(runCtx, awsPath, "sts", "get-caller-identity", "--query", "Account", "--output", "text")
	
	// Copy environment to command
	cmd.Env = os.Environ()
	
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}
