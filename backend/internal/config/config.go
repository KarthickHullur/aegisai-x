package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port       string
	DBHost     string
	DBPort     string
	DBName     string
	DBUser     string
	DBPassword string
}

// LoadEnv reads a key=value .env file and sets them in the environment
func LoadEnv(filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		// If the file doesn't exist, we skip it (environment variables might be set directly)
		return nil
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		// Remove quotes if present
		val = strings.Trim(val, `"'`)
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
	return scanner.Err()
}

// Load compiles config values and runs validation
func Load() (*Config, error) {
	port := os.Getenv("PORT")
if port == "" {
    port = "8082"
}
port = ":" + strings.TrimPrefix(port, ":")

	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")

	// Strict validation of database configuration
	if dbHost == "" || dbPort == "" || dbName == "" || dbUser == "" || dbPassword == "" {
		return nil, fmt.Errorf("missing critical database configuration. Required variables: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD")
	}

	return &Config{
		Port:       port,
		DBHost:     dbHost,
		DBPort:     dbPort,
		DBName:     dbName,
		DBUser:     dbUser,
		DBPassword: dbPassword,
	}, nil
}
