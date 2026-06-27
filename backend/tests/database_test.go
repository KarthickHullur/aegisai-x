package tests

import (
	"database/sql"
	"os"
	"testing"

	"aegisai-x/internal/database/migrations"
	"aegisai-x/internal/database/postgres"

	_ "github.com/lib/pq"
)

func TestPostgresDatabaseWorkflow(t *testing.T) {
	// Setup database connection settings using test variables or environment fallback
	host := os.Getenv("DB_HOST")
	if host == "" {
		t.Skip("PostgreSQL integration tests skipped (DB_HOST environment variable not configured)")
	}

	// Initialize the connection pool
	err := postgres.InitDB()
	if err != nil {
		t.Fatalf("Failed to initialize database: %v", err)
	}

	if postgres.DB == nil {
		t.Fatal("DB pool was nil after initialization")
	}

	// Run migrations
	err = migrations.RunMigrations(postgres.DB)
	if err != nil {
		t.Fatalf("Database migrations failed: %v", err)
	}

	// Verify default seeded items
	var agentCount int
	err = postgres.DB.QueryRow("SELECT COUNT(*) FROM agents").Scan(&agentCount)
	if err != nil {
		t.Fatalf("Failed to scan agents count: %v", err)
	}
	if agentCount == 0 {
		t.Error("Expected seeded SRE agents to be present, got 0")
	}

	// Test Memory Insertion & Recall workflow
	var incidentID int
	err = postgres.DB.QueryRow(`
		INSERT INTO incidents (title, severity, logs) 
		VALUES ($1, $2, $3) RETURNING id`,
		"Test DB Anomaly", "Medium", "Testing database logging integrity.",
	).Scan(&incidentID)
	if err != nil {
		t.Fatalf("Failed to insert mock incident: %v", err)
	}

	_, err = postgres.DB.Exec(`
		INSERT INTO investigations (incident_id, summary, root_cause, impact, recommendations)
		VALUES ($1, $2, $3, $4, $5)`,
		incidentID,
		"Mock database verification summary",
		"DB Lock contention occurred",
		"Transactional query delays",
		sql.NullString{String: "{'Scale connection pool','Check lock threads'}", Valid: true}, // standard pq array text format
	)
	if err != nil {
		t.Fatalf("Failed to insert mock investigation: %v", err)
	}

	// Verify Search Recall
	matches, err := postgres.SearchMemory("Anomaly")
	if err != nil {
		t.Fatalf("Search memory recall failed: %v", err)
	}
	if len(matches) == 0 {
		t.Error("Expected to retrieve newly inserted incident match, got 0 matches")
	}

	// Clean up test logs
	_, _ = postgres.DB.Exec("DELETE FROM incidents WHERE id = $1", incidentID)
}
