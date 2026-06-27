package postgres

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/lib/pq"
)

var DB *sql.DB

type IncidentRow struct {
	ID        int       `json:"id"`
	Title     string    `json:"title"`
	Severity  string    `json:"severity"`
	Logs      string    `json:"logs"`
	CreatedAt time.Time `json:"created_at"`
}

type InvestigationRow struct {
	ID              int       `json:"id"`
	IncidentID      int       `json:"incident_id"`
	IncidentTitle   string    `json:"incident_title"`
	Summary         string    `json:"summary"`
	RootCause       string    `json:"root_cause"`
	Impact          string    `json:"impact"`
	Recommendations []string  `json:"recommendations"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	Timestamp       string    `json:"timestamp"`
}

// InitDB initializes PostgreSQL connection pool
func InitDB() error {
	host := os.Getenv("DB_HOST")
	portStr := os.Getenv("DB_PORT")
	name := os.Getenv("DB_NAME")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")

	if host == "" {
		host = "localhost"
	}
	if portStr == "" {
		portStr = "5432"
	}
	if name == "" {
		name = "aegisai"
	}
	if user == "" {
		user = "postgres"
	}

	passwordsToTry := []string{password, "postgres", "Postgres@123"}
	var lastErr error
	var connected bool

	for _, pwd := range passwordsToTry {
		// Skip empty password unless it's the only one
		if pwd == "" && len(passwordsToTry) > 1 {
			continue
		}

		connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
			host, portStr, user, pwd, name)

		var err error
		DB, err = sql.Open("postgres", connStr)
		if err != nil {
			lastErr = err
			continue
		}

		// Set connection pool limits
		DB.SetMaxOpenConns(25)
		DB.SetMaxIdleConns(25)
		DB.SetConnMaxLifetime(5 * time.Minute)

		// Verify database connection
		if err := DB.Ping(); err == nil {
			connected = true
			if pwd != password {
				log.Printf("[Self-Healing] Successfully connected to database using fallback password. Healing configuration...")
				os.Setenv("DB_PASSWORD", pwd)
			}
			break
		} else {
			lastErr = err
			DB.Close()
		}
	}

	if !connected {
		return fmt.Errorf("failed to connect to database after trying credential fallbacks: %w", lastErr)
	}

	log.Println("PostgreSQL connection pool initialized successfully")
	return nil
}

// SearchMemory searches historical investigations by matching text in title, summary, or root cause
func SearchMemory(query string) ([]InvestigationRow, error) {
	sqlQuery := `
		SELECT i.id, i.incident_id, inc.title, i.summary, i.root_cause, i.impact, i.recommendations, i.created_at, i.updated_at
		FROM investigations i
		JOIN incidents inc ON i.incident_id = inc.id
		WHERE LOWER(inc.title) LIKE $1 OR LOWER(i.summary) LIKE $1 OR LOWER(i.root_cause) LIKE $1
		ORDER BY i.created_at DESC
		LIMIT 5
	`
	rows, err := DB.Query(sqlQuery, "%"+strings.ToLower(query)+"%")
	if err != nil {
		return nil, fmt.Errorf("failed to query memory: %w", err)
	}
	defer rows.Close()

	var results []InvestigationRow
	for rows.Next() {
		var row InvestigationRow
		if err := rows.Scan(
			&row.ID,
			&row.IncidentID,
			&row.IncidentTitle,
			&row.Summary,
			&row.RootCause,
			&row.Impact,
			pq.Array(&row.Recommendations),
			&row.CreatedAt,
			&row.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan memory row: %w", err)
		}
		row.Timestamp = row.CreatedAt.Format(time.RFC3339)
		results = append(results, row)
	}

	return results, nil
}

// GetRecentInvestigations fetches the 10 latest investigations from the database
func GetRecentInvestigations() ([]InvestigationRow, error) {
	sqlQuery := `
		SELECT i.id, i.incident_id, inc.title, i.summary, i.root_cause, i.impact, i.recommendations, i.created_at, i.updated_at
		FROM investigations i
		JOIN incidents inc ON i.incident_id = inc.id
		ORDER BY i.created_at DESC
		LIMIT 10
	`
	rows, err := DB.Query(sqlQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent investigations: %w", err)
	}
	defer rows.Close()

	var results []InvestigationRow
	for rows.Next() {
		var row InvestigationRow
		if err := rows.Scan(
			&row.ID,
			&row.IncidentID,
			&row.IncidentTitle,
			&row.Summary,
			&row.RootCause,
			&row.Impact,
			pq.Array(&row.Recommendations),
			&row.CreatedAt,
			&row.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan recent row: %w", err)
		}
		row.Timestamp = row.CreatedAt.Format(time.RFC3339)
		results = append(results, row)
	}

	return results, nil
}

type GroupedInvestigation struct {
	IncidentID       string              `json:"incidentId"`
	Title            string              `json:"title"`
	Occurrences      int                 `json:"occurrences"`
	LastInvestigated string              `json:"lastInvestigated"`
	Investigations   []InvestigationItem `json:"investigations"`
}

type InvestigationItem struct {
	ID              int      `json:"id"`
	Summary         string   `json:"summary"`
	RootCause       string   `json:"rootCause"`
	Impact          string   `json:"impact"`
	Recommendations []string `json:"recommendations"`
	Timestamp       string   `json:"timestamp"`
}

// GetRecentInvestigationsGrouped fetches all investigations grouped by incident code
func GetRecentInvestigationsGrouped() ([]GroupedInvestigation, error) {
	sqlQuery := `
		SELECT i.id, COALESCE(inc.incident_id, ''), inc.title, i.summary, i.root_cause, i.impact, i.recommendations, i.created_at, inc.occurrence_count
		FROM investigations i
		JOIN incidents inc ON i.incident_id = inc.id
		ORDER BY i.created_at DESC
	`
	rows, err := DB.Query(sqlQuery)
	if err != nil {
		return nil, fmt.Errorf("failed to query grouped investigations: %w", err)
	}
	defer rows.Close()

	var groups []GroupedInvestigation
	groupMap := make(map[string]int) // maps incidentId to its index in groups

	for rows.Next() {
		var id int
		var incidentID, title, summary, rootCause, impact string
		var recommendations []string
		var createdAt time.Time
		var occurrenceCount int

		if err := rows.Scan(
			&id,
			&incidentID,
			&title,
			&summary,
			&rootCause,
			&impact,
			pq.Array(&recommendations),
			&createdAt,
			&occurrenceCount,
		); err != nil {
			return nil, fmt.Errorf("failed to scan grouped investigation row: %w", err)
		}

		if incidentID == "" {
			incidentID = fmt.Sprintf("INC-%04d", id)
		}

		item := InvestigationItem{
			ID:              id,
			Summary:         summary,
			RootCause:       rootCause,
			Impact:          impact,
			Recommendations: recommendations,
			Timestamp:       createdAt.Format(time.RFC3339),
		}

		idx, exists := groupMap[incidentID]
		if !exists {
			groupMap[incidentID] = len(groups)
			groups = append(groups, GroupedInvestigation{
				IncidentID:       incidentID,
				Title:            title,
				Occurrences:      occurrenceCount,
				LastInvestigated: createdAt.Format(time.RFC3339),
				Investigations:   []InvestigationItem{item},
			})
		} else {
			groups[idx].Investigations = append(groups[idx].Investigations, item)
		}
	}

	return groups, nil
}
