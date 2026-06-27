package aws

import (
	"context"
	"database/sql"
	"log"
	"time"
)

// StartPoller initiates background polling for AWS resources, security findings, and incidents
func StartPoller(db *sql.DB) {
	log.Println("[AWS] AWS integration started.")

	syncAWS(db)

	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			syncAWS(db)
		}
	}()
}

func syncAWS(db *sql.DB) {
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	InitClient(ctx)

	if err := PollResources(ctx, db); err != nil {
		log.Printf("[AWS Poller Error] Resource discovery failed: %v", err)
	}

	if err := PollSecurity(ctx, db); err != nil {
		log.Printf("[AWS Poller Error] Security compliance audit failed: %v", err)
	}

	if err := PollIncidents(ctx, db); err != nil {
		log.Printf("[AWS Poller Error] Incident generation failed: %v", err)
	}
}
