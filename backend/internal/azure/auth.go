package azure

import (
	"context"
	"os"
	"os/exec"
)

// CheckServicePrincipalAuth returns true if service principal env vars are set
func CheckServicePrincipalAuth() bool {
	return os.Getenv("AZURE_CLIENT_ID") != "" &&
		os.Getenv("AZURE_CLIENT_SECRET") != "" &&
		os.Getenv("AZURE_TENANT_ID") != "" &&
		os.Getenv("AZURE_SUBSCRIPTION_ID") != ""
}

// CheckCLIAuth returns true if azure cli is installed and active
func CheckCLIAuth(ctx context.Context) bool {
	azPath := GetAZPath()
	cmd := exec.CommandContext(ctx, azPath, "account", "show")
	err := cmd.Run()
	return err == nil
}
