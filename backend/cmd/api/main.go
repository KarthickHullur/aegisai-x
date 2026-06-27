package main

import (
	"context"
	"database/sql"
	"log"
	"path/filepath"

	"aegisai-x/internal/api/routes"
	"aegisai-x/internal/aws"
	"aegisai-x/internal/azure"
	"aegisai-x/internal/cloud"
	"aegisai-x/internal/config"
	"aegisai-x/internal/database/migrations"
	"aegisai-x/internal/database/postgres"
	"aegisai-x/internal/docker"
	"aegisai-x/internal/kubernetes"
	"aegisai-x/internal/prometheus"
	"aegisai-x/internal/security"
	"aegisai-x/internal/selfhealing"
)

func main() {
	// 0. Resolve paths dynamically and perform self-healing verification
	projectRoot, backendPath, cwd := selfhealing.ResolvePaths()
	log.Printf("[Startup] Project Root: %s", projectRoot)
	log.Printf("[Startup] Backend Path: %s", backendPath)
	log.Printf("[Startup] Working Directory: %s", cwd)

	selfhealing.CheckAndHeal(projectRoot, backendPath)

	// 1. Load env secrets from .env file
	if err := config.LoadEnv(filepath.Join(backendPath, ".env")); err != nil {
		log.Fatalf("[Initialization Error] Failed to load .env variables: %v", err)
	}

	// 2. Load and validate environment configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[Initialization Error] Configuration validation failed: %v", err)
	}

	// 3. Initialize PostgreSQL Connection Pool
	if err := postgres.InitDB(); err != nil {
		log.Fatalf("[Initialization Error] Database connection failed: %v", err)
	}
	log.Println("[Startup] PostgreSQL Connected")

	// 4. Run Migrations & Seeding queries
	if err := migrations.RunMigrations(postgres.DB); err != nil {
		log.Fatalf("[Initialization Error] Database migrations failed: %v", err)
	}
	log.Println("[Startup] Database Migrations Completed")

	// Register update hooks for security scoring engine
	docker.RegisterUpdateHook(security.TriggerRecalculate)
	kubernetes.RegisterUpdateHook(security.TriggerRecalculate)
	prometheus.RegisterUpdateHook(security.TriggerRecalculate)

	// Register cloud connection sync hooks
	cloud.DockerSyncHook = docker.PollDocker
	cloud.K8sSyncHook = kubernetes.PollKubernetes
	cloud.AzureSyncHook = func(ctx context.Context, db *sql.DB) {
		azure.PollResources(ctx, db)
		azure.PollMetrics(ctx, db)
		azure.PollSecurity(ctx, db)
		azure.PollIncidents(ctx, db)
	}
	cloud.AWSSyncHook = func(ctx context.Context, db *sql.DB) {
		aws.PollResources(ctx, db)
		aws.PollSecurity(ctx, db)
		aws.PollIncidents(ctx, db)
	}

	// Start background polling for local Docker engine status and metrics
	docker.StartPolling(postgres.DB)
	log.Println("[Startup] Docker Integration Initialized")

	// Start background polling for local Kubernetes cluster status and resources
	kubernetes.StartPolling(postgres.DB)
	log.Println("[Startup] Kubernetes Integration Initialized")

	// Start background polling for Prometheus status, alerts, and metrics
	prometheus.StartPolling(postgres.DB)
	log.Println("[Startup] Prometheus Integration Initialized")

	// Initialize Security Scoring Engine
	security.StartEngine(postgres.DB)
	log.Println("[Startup] Security Score Engine Initialized")

	// Initialize Azure Integration Poller
	azure.StartPoller(postgres.DB)
	log.Println("[Startup] Azure Integration Initialized")

	// Initialize AWS Integration Poller
	aws.StartPoller(postgres.DB)
	log.Println("[Startup] AWS Integration Initialized")

	// 5. Initialize active route engine
	r := routes.SetupRoutes()

	// Run startup API Self-Tests
	selfhealing.RunSelfTests(r)

	// 6. Start server
	log.Printf("[Startup] API Server Listening on %s", cfg.Port)
	if err := r.Run(cfg.Port); err != nil {
		log.Fatalf("[Server Status] Failed to run backend server: %v", err)
	}
}
