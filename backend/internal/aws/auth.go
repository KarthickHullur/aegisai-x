package aws

import (
	"context"
	"os"
	"os/exec"
	"time"
)

// CheckEnvAuth returns true if AWS credential environment variables are set
func CheckEnvAuth() bool {
	return (os.Getenv("AWS_ACCESS_KEY_ID") != "" && os.Getenv("AWS_SECRET_ACCESS_KEY") != "") ||
		(os.Getenv("AWS_ACCESS_KEY_ID_MOCK") != "" && os.Getenv("AWS_SECRET_ACCESS_KEY_MOCK") != "") // allow mock overrides for testing
}

// CheckCLIAuth returns true if aws cli is installed and has a valid authenticated session
func CheckCLIAuth(ctx context.Context) bool {
	awsPath := GetAWSPath()
	runCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	cmd := exec.CommandContext(runCtx, awsPath, "sts", "get-caller-identity")
	
	// Copy environment
	cmd.Env = os.Environ()
	
	err := cmd.Run()
	return err == nil
}
