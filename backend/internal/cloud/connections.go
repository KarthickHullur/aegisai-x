package cloud

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"aegisai-x/internal/database/postgres"
	"aegisai-x/internal/utils"

	// Import clients for testing
	dockertypes "github.com/docker/docker/api/types/container"
	dockerimage "github.com/docker/docker/api/types/image"
	dockernetwork "github.com/docker/docker/api/types/network"
	dockervolume "github.com/docker/docker/api/types/volume"
	dockerclient "github.com/docker/docker/client"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8sclient "k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

type Connection struct {
	ID                   int             `json:"id"`
	Provider             string          `json:"provider"`
	ConnectionType       string          `json:"connectionType"`
	EncryptedCredentials string          `json:"-"`
	Status               string          `json:"status"`
	LastSync             time.Time       `json:"lastSync"`
	Metadata             json.RawMessage `json:"metadata"`
	CreatedAt            time.Time       `json:"createdAt"`
	UpdatedAt            time.Time       `json:"updatedAt"`
}

// DockerCreds represents credentials for Docker connection
type DockerCreds struct {
	Endpoint string `json:"endpoint"`
}

// K8sCreds represents credentials for Kubernetes connection
type K8sCreds struct {
	Kubeconfig string `json:"kubeconfig"`
}

// AzureCreds represents credentials for Azure connection
type AzureCreds struct {
	TenantID       string `json:"tenantId,omitempty"`
	ClientID       string `json:"clientId,omitempty"`
	ClientSecret   string `json:"clientSecret,omitempty"`
	SubscriptionID string `json:"subscriptionId,omitempty"`
}

// AWSCreds represents credentials for AWS connection
type AWSCreds struct {
	AccessKeyID     string `json:"accessKeyId,omitempty"`
	SecretAccessKey string `json:"secretAccessKey,omitempty"`
	Region          string `json:"region,omitempty"`
}

// GetAZPath returns path to azure cli
func GetAZPath() string {
	path, err := exec.LookPath("az")
	if err == nil {
		return path
	}
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

// GetAWSPath returns path to aws cli
func GetAWSPath() string {
	path, err := exec.LookPath("aws")
	if err == nil {
		return path
	}
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

// TestConnection tests connection parameters without saving them to the DB
func TestConnection(ctx context.Context, provider, connType, credsJSON string) (bool, string, map[string]interface{}, error) {
	details := make(map[string]interface{})

	switch provider {
	case "docker":
		var creds DockerCreds
		if err := json.Unmarshal([]byte(credsJSON), &creds); err != nil {
			return false, "Invalid JSON credentials", nil, err
		}
		endpoint := creds.Endpoint
		if endpoint == "" {
			if runtime.GOOS == "windows" {
				endpoint = "npipe:////./pipe/dockerDesktopLinuxEngine"
			} else {
				endpoint = "unix:///var/run/docker.sock"
			}
		}

		c, err := dockerclient.NewClientWithOpts(dockerclient.WithHost(endpoint), dockerclient.WithAPIVersionNegotiation())
		if err != nil {
			return false, fmt.Sprintf("Failed to construct client: %v", err), nil, err
		}
		defer c.Close()

		_, err = c.Ping(ctx)
		if err != nil {
			return false, fmt.Sprintf("Ping failed: %v. Ensure Docker is running and endpoint is accessible.", err), nil, err
		}

		versionInfo, err := c.ServerVersion(ctx)
		if err != nil {
			return false, fmt.Sprintf("Failed to get server version: %v", err), nil, err
		}

		containers, _ := c.ContainerList(ctx, dockertypes.ListOptions{All: true})
		images, _ := c.ImageList(ctx, dockerimage.ListOptions{All: true})
		networks, _ := c.NetworkList(ctx, dockernetwork.ListOptions{})
		volumes, _ := c.VolumeList(ctx, dockervolume.ListOptions{})

		details["version"] = versionInfo.Version
		details["containers"] = len(containers)
		details["images"] = len(images)
		details["networks"] = len(networks)
		details["volumes"] = len(volumes.Volumes)

		return true, "Docker connection successful", details, nil

	case "kubernetes":
		var kubeconfig string

var creds K8sCreds
if err := json.Unmarshal([]byte(credsJSON), &creds); err == nil &&
	strings.TrimSpace(creds.Kubeconfig) != "" {

	kubeconfig = creds.Kubeconfig
} else {
	kubeconfig = strings.TrimSpace(credsJSON)
}

if kubeconfig == "" {
	return false,
		"Kubeconfig content cannot be empty",
		nil,
		fmt.Errorf("empty kubeconfig")
}

log.Println("========== KUBECONFIG ==========")
log.Println(kubeconfig)
log.Println("================================")

restConfig, err := clientcmd.RESTConfigFromKubeConfig(
	[]byte(kubeconfig),
)
if err != nil {
	return false,
		fmt.Sprintf("Invalid kubeconfig: %v", err),
		nil,
		err
}

restConfig.Timeout = 10 * time.Second

		cs, err := k8sclient.NewForConfig(restConfig)
		if err != nil {
			return false, fmt.Sprintf("Failed to build client: %v", err), nil, err
		}

		versionInfo, err := cs.Discovery().ServerVersion()
		if err != nil {
			return false, fmt.Sprintf("Failed to reach cluster API: %v", err), nil, err
		}

		nodes, _ := cs.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
		namespaces, _ := cs.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})

		clusterName := "unknown-cluster"
		rawConf, errRaw := clientcmd.Load([]byte(kubeconfig))
		currentCtx := "default"
		if errRaw == nil {
			currentCtx = rawConf.CurrentContext
			if rawConf.Contexts[currentCtx] != nil {
				clusterName = rawConf.Contexts[currentCtx].Cluster
			}
		}

		details["clusterName"] = clusterName
		details["context"] = currentCtx
		details["version"] = versionInfo.GitVersion
		details["nodes"] = len(nodes.Items)
		details["namespaces"] = len(namespaces.Items)

		return true, "Kubernetes connection successful", details, nil

	case "azure":
		if connType == "cli-login" {
			azPath := GetAZPath()
			cmd := exec.CommandContext(ctx, azPath, "account", "show", "--query", "name", "-o", "tsv")
			out, err := cmd.Output()
			if err != nil {
				return false, "Azure CLI not authenticated. Run 'az login' on the host first.", nil, err
			}
			subName := strings.TrimSpace(string(out))

			cmdID := exec.CommandContext(ctx, azPath, "account", "show", "--query", "id", "-o", "tsv")
			outID, _ := cmdID.Output()
			subID := strings.TrimSpace(string(outID))

			details["subscriptionName"] = subName
			details["subscriptionId"] = subID
			return true, "Azure CLI login detected", details, nil
		} else if connType == "service-principal" {
			var creds AzureCreds
			if err := json.Unmarshal([]byte(credsJSON), &creds); err != nil {
				return false, "Invalid JSON credentials", nil, err
			}
			if creds.TenantID == "" || creds.ClientID == "" || creds.ClientSecret == "" || creds.SubscriptionID == "" {
				return false, "TenantID, ClientID, ClientSecret, and SubscriptionID are required", nil, fmt.Errorf("missing credentials")
			}

			azPath := GetAZPath()
			cmd := exec.CommandContext(ctx, azPath, "login", "--service-principal",
				"-u", creds.ClientID, "-p", creds.ClientSecret, "--tenant", creds.TenantID)
			err := cmd.Run()
			if err != nil {
				return false, fmt.Sprintf("Service Principal login failed: %v", err), nil, err
			}

			// Verify setting subscription
			cmdSet := exec.CommandContext(ctx, azPath, "account", "set", "--subscription", creds.SubscriptionID)
			_ = cmdSet.Run()

			cmdSub := exec.CommandContext(ctx, azPath, "account", "show", "--query", "name", "-o", "tsv")
			outSub, _ := cmdSub.Output()

			details["subscriptionName"] = strings.TrimSpace(string(outSub))
			details["subscriptionId"] = creds.SubscriptionID
			return true, "Service Principal login verified successfully", details, nil
		}
		return false, "Unsupported connection type", nil, fmt.Errorf("invalid connection type")

	case "aws":
		if connType == "cli-login" {
			awsPath := GetAWSPath()
			cmd := exec.CommandContext(ctx, awsPath, "sts", "get-caller-identity", "--query", "Account", "--output", "text")
			out, err := cmd.Output()
			if err != nil {
				return false, "AWS CLI not authenticated. Run 'aws configure' on host.", nil, err
			}
			accountID := strings.TrimSpace(string(out))

			cmdArn := exec.CommandContext(ctx, awsPath, "sts", "get-caller-identity", "--query", "Arn", "--output", "text")
			outArn, _ := cmdArn.Output()

			details["accountId"] = accountID
			details["arn"] = strings.TrimSpace(string(outArn))
			return true, "AWS CLI login detected", details, nil
		} else if connType == "access-keys" {
			var creds AWSCreds
			if err := json.Unmarshal([]byte(credsJSON), &creds); err != nil {
				return false, "Invalid JSON credentials", nil, err
			}
			if creds.AccessKeyID == "" || creds.SecretAccessKey == "" || creds.Region == "" {
				return false, "AccessKeyID, SecretAccessKey, and Region are required", nil, fmt.Errorf("missing credentials")
			}

			awsPath := GetAWSPath()
			cmd := exec.CommandContext(ctx, awsPath, "sts", "get-caller-identity", "--query", "Account", "--output", "text")
			cmd.Env = append(os.Environ(),
				"AWS_ACCESS_KEY_ID="+creds.AccessKeyID,
				"AWS_SECRET_ACCESS_KEY="+creds.SecretAccessKey,
				"AWS_DEFAULT_REGION="+creds.Region,
				"AWS_REGION="+creds.Region,
			)
			out, err := cmd.Output()
			if err != nil {
				return false, fmt.Sprintf("AWS credentials invalid or not authorized: %v", err), nil, err
			}
			accountID := strings.TrimSpace(string(out))

			cmdArn := exec.CommandContext(ctx, awsPath, "sts", "get-caller-identity", "--query", "Arn", "--output", "text")
			cmdArn.Env = cmd.Env
			outArn, _ := cmdArn.Output()

			details["accountId"] = accountID
			details["arn"] = strings.TrimSpace(string(outArn))
			details["region"] = creds.Region
			return true, "Access keys verified successfully", details, nil
		}
		return false, "Unsupported connection type", nil, fmt.Errorf("invalid connection type")
	}

	return false, "Unknown provider", nil, fmt.Errorf("unknown provider")
}

// Connect saves the connection, encrypts credentials, and fires background synchronization
func Connect(ctx context.Context, db *sql.DB, provider, connType, credentials string) error {
	// 1. Test the connection first
	ok, msg, details, err := TestConnection(ctx, provider, connType, credentials)
	if !ok || err != nil {
		return fmt.Errorf("connection test failed: %s (err: %v)", msg, err)
	}

	// 2. Encrypt credentials
	encrypted, err := utils.Encrypt(credentials)
	if err != nil {
		return fmt.Errorf("failed to encrypt credentials: %w", err)
	}

	detailsBytes, _ := json.Marshal(details)

	// 3. Upsert connection record
	query := `
		INSERT INTO cloud_connections (provider, connection_type, encrypted_credentials, status, last_sync, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, 'connected', CURRENT_TIMESTAMP, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT (provider) 
		DO UPDATE SET connection_type = EXCLUDED.connection_type,
		              encrypted_credentials = EXCLUDED.encrypted_credentials,
		              status = 'connected',
		              last_sync = CURRENT_TIMESTAMP,
		              metadata = EXCLUDED.metadata,
		              updated_at = CURRENT_TIMESTAMP
	`
	_, err = db.ExecContext(ctx, query, provider, connType, encrypted, string(detailsBytes))
	if err != nil {
		return fmt.Errorf("failed to save connection to database: %w", err)
	}

	log.Printf("[Cloud Connections] Successfully connected and stored provider: %s", provider)

	// 4. Trigger background discovery/sync dynamically
	go TriggerSyncBackground(provider)

	return nil
}

// Disconnect removes credentials and marks the provider as disconnected
func Disconnect(ctx context.Context, db *sql.DB, provider string) error {
	// For security, delete the record completely so credentials are removed
	_, err := db.ExecContext(ctx, "DELETE FROM cloud_connections WHERE provider = $1", provider)
	if err != nil {
		return fmt.Errorf("failed to delete connection record: %w", err)
	}

	// Remove environment variables if Azure or AWS
	if provider == "azure" {
		os.Unsetenv("AZURE_CLIENT_ID")
		os.Unsetenv("AZURE_CLIENT_SECRET")
		os.Unsetenv("AZURE_TENANT_ID")
		os.Unsetenv("AZURE_SUBSCRIPTION_ID")
	} else if provider == "aws" {
		os.Unsetenv("AWS_ACCESS_KEY_ID")
		os.Unsetenv("AWS_SECRET_ACCESS_KEY")
		os.Unsetenv("AWS_DEFAULT_REGION")
		os.Unsetenv("AWS_REGION")
	}

	log.Printf("[Cloud Connections] Disconnected provider: %s", provider)
	return nil
}

// TriggerSyncBackground executes discovery, security scan, and recommendations logic in background
func TriggerSyncBackground(provider string) {
	log.Printf("[Sync Background] Starting immediate sync flow for: %s", provider)
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	// Since we import aws/azure/docker/kubernetes dynamically in cmd/api, we can fetch
	// the DB and call their exposed sync/poll operations. To avoid circular package dependencies
	// when importing them here, we will invoke the poll functions dynamically.
	// Since we need to call package-level functions in aws, azure, docker, and kubernetes,
	// let's define hook variables in connections.go that those packages can register themselves in!
	// This is a standard Go pattern to decouple packages.
	
	switch provider {
	case "docker":
		if DockerSyncHook != nil {
			DockerSyncHook(ctx, postgres.DB)
		}
	case "kubernetes":
		if K8sSyncHook != nil {
			K8sSyncHook(ctx, postgres.DB)
		}
	case "azure":
		if AzureSyncHook != nil {
			AzureSyncHook(ctx, postgres.DB)
		}
	case "aws":
		if AWSSyncHook != nil {
			AWSSyncHook(ctx, postgres.DB)
		}
	}
}

// Sync hooks for registration by provider packages to prevent circular dependencies
var (
	DockerSyncHook func(ctx context.Context, db *sql.DB)
	K8sSyncHook    func(ctx context.Context, db *sql.DB)
	AzureSyncHook  func(ctx context.Context, db *sql.DB)
	AWSSyncHook    func(ctx context.Context, db *sql.DB)
)
