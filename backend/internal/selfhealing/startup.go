package selfhealing

import (
	"log"
	"os"
	"path/filepath"
	"strings"
)

// ResolvePaths dynamically detects and resolves project root, backend path, and working directory
func ResolvePaths() (string, string, string) {
	cwd, err := os.Getwd()
	if err != nil {
		cwd = "."
	}
	cwdAbs, err := filepath.Abs(cwd)
	if err != nil {
		cwdAbs = cwd
	}

	var projectRoot, backendPath string
	if strings.Contains(strings.ToLower(cwdAbs), "backend") {
		// Find the index of "backend" in path
		idx := strings.Index(strings.ToLower(cwdAbs), "backend")
		backendPath = cwdAbs[:idx+7] // length of "backend" is 7
		projectRoot = filepath.Dir(backendPath)
	} else {
		// Assume launched from project root
		projectRoot = cwdAbs
		backendPath = filepath.Join(cwdAbs, "backend")
	}

	return projectRoot, backendPath, cwdAbs
}

// CheckAndHeal performs startup checks for directories, files, and environment variables
func CheckAndHeal(projectRoot, backendPath string) {
	// 1. Verify and create missing directories
	dirs := []string{
		filepath.Join(projectRoot, "backend"),
		filepath.Join(projectRoot, "frontend"),
		filepath.Join(projectRoot, "backend", "cmd"),
		filepath.Join(projectRoot, "backend", "internal"),
	}

	for _, d := range dirs {
		if _, err := os.Stat(d); os.IsNotExist(err) {
			log.Printf("[Self-Healing] Missing directory detected: %s", d)
			if err := os.MkdirAll(d, 0755); err == nil {
				log.Printf("[Self-Healing] Created missing directory: %s", d)
			} else {
				log.Printf("[Self-Healing Error] Failed to create directory %s: %v", d, err)
			}
		}
	}

	// 2. Verify backend .env file exists. If not, generate a default one
	envPath := filepath.Join(backendPath, ".env")
	if _, err := os.Stat(envPath); os.IsNotExist(err) {
		log.Printf("[Self-Healing] Missing backend .env file: %s", envPath)
		defaultEnv := `# Application Port
PORT=:8082

DB_HOST=localhost
DB_PORT=5432
DB_NAME=aegisai
DB_USER=postgres
DB_PASSWORD=postgres

GEMINI_API_KEY=YOUR_GEMINI_API_KEY
`

if err := os.WriteFile(envPath, []byte(defaultEnv), 0644); err == nil {
	log.Println("[Self-Healing] Generated default backend .env file")
} else {
	log.Printf("[Self-Healing Error] Failed to generate backend .env file: %v", err)
}
} // <-- ADD THIS BRACE

// 3. Check for critical environment variables
requiredEnv := []string{
	"DB_HOST",
	"DB_PORT",
	"DB_NAME",
	"DB_USER",
	"DB_PASSWORD",
}

for _, env := range requiredEnv {
	if os.Getenv(env) == "" {
		log.Printf("[Self-Healing Warning] Missing critical environment variable: %s", env)
	}
}
}
