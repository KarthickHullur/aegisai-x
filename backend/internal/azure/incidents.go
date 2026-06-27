package azure

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"

	"aegisai-x/internal/ai"
)

// PollIncidents audits resources for degradation, raising SRE incidents
func PollIncidents(ctx context.Context, db *sql.DB) error {
	client := GetClient()
	if client == nil {
		return nil
	}

	// 1. Audit stopped VMs
	rowsVM, err := db.QueryContext(ctx, "SELECT name, status FROM azure_vms WHERE is_live = TRUE")
	if err == nil {
		defer rowsVM.Close()
		for rowsVM.Next() {
			var name, status string
			if err := rowsVM.Scan(&name, &status); err == nil {
				if status == "VM stopped" {
					title := fmt.Sprintf("Azure VM Unavailable: %s", name)
					logs := fmt.Sprintf("Virtual machine %s status is stopped. PowerState: stopped.", name)
					CreateOrUpdateAzureIncident(ctx, db, title, "High", logs)
				} else {
					title := fmt.Sprintf("Azure VM Unavailable: %s", name)
					_, _ = db.ExecContext(ctx, "DELETE FROM incidents WHERE title = $1 AND source = 'azure' AND status = 'Open'", title)
				}
			}
		}
	}

	// 2. Audit unhealthy AKS clusters
	rowsAKS, err := db.QueryContext(ctx, "SELECT name, status FROM azure_aks_clusters WHERE is_live = TRUE")
	if err == nil {
		defer rowsAKS.Close()
		for rowsAKS.Next() {
			var name, status string
			if err := rowsAKS.Scan(&name, &status); err == nil {
				if status != "Succeeded" && status != "Running" {
					title := fmt.Sprintf("Azure AKS Unhealthy: %s", name)
					logs := fmt.Sprintf("AKS Managed Cluster %s is in state: %s. Node pool status is degraded.", name, status)
					CreateOrUpdateAzureIncident(ctx, db, title, "Critical", logs)
				} else {
					title := fmt.Sprintf("Azure AKS Unhealthy: %s", name)
					_, _ = db.ExecContext(ctx, "DELETE FROM incidents WHERE title = $1 AND source = 'azure' AND status = 'Open'", title)
				}
			}
		}
	}

	return nil
}

// CreateOrUpdateAzureIncident logs an incident, runs SRE AI analysis, and saves to SRE runbooks
func CreateOrUpdateAzureIncident(ctx context.Context, db *sql.DB, title, severity, logs string) {
	var incidentID int
	var currentCount int

	queryCheck := "SELECT id, occurrence_count FROM incidents WHERE title = $1 AND source = 'azure' AND status = 'Open' LIMIT 1"
	err := db.QueryRowContext(ctx, queryCheck, title).Scan(&incidentID, &currentCount)

	if err == nil {
		newCount := currentCount + 1
		queryUpdate := "UPDATE incidents SET occurrence_count = $1, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2"
		_, _ = db.ExecContext(ctx, queryUpdate, newCount, incidentID)
		log.Printf("[Azure Incident] Updated existing incident %s (occurrences: %d)", title, newCount)
	} else {
		queryInsert := `
			INSERT INTO incidents (title, source, severity, logs, status, occurrence_count, first_seen, last_seen, created_at, updated_at)
			VALUES ($1, 'azure', $2, $3, 'Open', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			RETURNING id
		`
		var newID int
		err = db.QueryRowContext(ctx, queryInsert, title, severity, logs).Scan(&newID)
		if err != nil {
			log.Printf("[Azure Incident Error] Failed to insert incident: %v", err)
			return
		}

		code := fmt.Sprintf("INC-%04d", newID)
		_, _ = db.ExecContext(ctx, "UPDATE incidents SET incident_id = $1 WHERE id = $2", code, newID)

		// AI Investigator Analysis
		var summary, rootCause, impact string
		var recommendations []string

		aiClient, aiErr := ai.NewAIClient(ctx)
		if aiErr == nil {
			investigator := ai.NewInvestigator(aiClient)
			aiResult, err := investigator.Investigate(ctx, title, severity, logs, "")
			if err == nil {
				summary = aiResult.Summary
				rootCause = aiResult.RootCause
				impact = aiResult.Impact
				recommendations = aiResult.Recommendations
			}
		}

		if summary == "" {
			summary = fmt.Sprintf("AI SRE detected Azure resource outage: %s", title)
			rootCause = fmt.Sprintf("Virtual machine or cluster status is degraded: %s", logs)
			impact = "Resource service unavailability, possible API connection failure."
			if strings.Contains(title, "VM") {
				recommendations = []string{
					"Review Azure compute activity logs for restart events.",
					"Execute restart runbook or check CPU quota scaling limits.",
				}
			} else {
				recommendations = []string{
					"Inspect AKS Node pool health status via kubectl get nodes.",
					"Verify resource limits on default deployment namespaces.",
				}
			}
		}

		queryInvestigation := `
			INSERT INTO investigations (incident_id, summary, root_cause, impact, recommendations, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`

		recArray := "{"
		for idx, r := range recommendations {
			if idx > 0 {
				recArray += ","
			}
			recArray += `"` + strings.ReplaceAll(r, `"`, `\"`) + `"`
		}
		recArray += "}"

		_, _ = db.ExecContext(ctx, queryInvestigation, newID, summary, rootCause, impact, recArray)

		queryMemory := `
			INSERT INTO memory_records (title, category, content, created_at, updated_at)
			VALUES ($1, 'incident', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`
		memContent := fmt.Sprintf("Incident %s: %s. Mitigation: SRE AI generated action recommendations saved to cloud console.", code, rootCause)
		_, _ = db.ExecContext(ctx, queryMemory, title, memContent)

		log.Printf("[Azure Incident] Created new incident %s with code %s", title, code)
	}
}
