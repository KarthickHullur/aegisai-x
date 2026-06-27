package azure

import (
	"context"
	"database/sql"
	"log"
	"time"
)

// StartPoller initiates background polling for Azure resources, metrics, security, and incidents
func StartPoller(db *sql.DB) {
	log.Println("[Azure] Azure poller started.")

	syncAzure(db)

	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			syncAzure(db)
		}
	}()
}

func syncAzure(db *sql.DB) {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	InitClient(ctx)

	if err := PollResources(ctx, db); err != nil {
		log.Printf("[Azure Poller Error] Resource discovery failed: %v", err)
	}

	if err := PollMetrics(ctx, db); err != nil {
		log.Printf("[Azure Poller Error] Metrics collection failed: %v", err)
	}

	if err := PollSecurity(ctx, db); err != nil {
		log.Printf("[Azure Poller Error] Security compliance audit failed: %v", err)
	}

	if err := PollIncidents(ctx, db); err != nil {
		log.Printf("[Azure Poller Error] Incident generation failed: %v", err)
	}
}
