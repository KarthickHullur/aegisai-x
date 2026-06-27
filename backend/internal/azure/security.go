package azure

import (
	"context"
	"database/sql"
	"log"
)

// PollSecurity audits Azure resources for security posture compliance
func PollSecurity(ctx context.Context, db *sql.DB) error {
	client := GetClient()
	if client == nil || !client.Connected {
		// Degraded mode: do not overwrite the seeded security findings
		return nil
	}

	log.Println("[Azure] Auditing security rules...")

	// Always insert the informational finding about Azure for Students policies
	upsertSecurityFinding(ctx, db, "sec-find-student-policy", "Low", "Azure Subscription", "Some Azure resource types may be restricted under Azure for Students subscription policies.", "Informational")

	// Always insert recommendations for students
	upsertRecommendation(ctx, db, "rec-student-1", "Azure Subscription", "General", "Continue using Resource Groups for testing.", "Low")
	upsertRecommendation(ctx, db, "rec-student-2", "Azure Subscription", "General", "Use read-only discovery APIs.", "Low")
	upsertRecommendation(ctx, db, "rec-student-3", "Azure Subscription", "General", "Use demo mode when resources are unavailable.", "Low")
	upsertRecommendation(ctx, db, "rec-student-4", "Azure Subscription", "General", "Create resources only when subscription policies permit.", "Low")

	// 1. Query current virtual machines
	rowsVM, err := db.QueryContext(ctx, "SELECT id, name, status FROM azure_vms WHERE is_live = TRUE")
	if err == nil {
		defer rowsVM.Close()
		for rowsVM.Next() {
			var id, name, status string
			if err := rowsVM.Scan(&id, &name, &status); err == nil {
				if status == "VM stopped" {
					upsertSecurityFinding(ctx, db, "sec-find-vm-"+name, "High", name, "Virtual machine is stopped unexpectedly. Verify power state or start service if necessary.", "Open")
					upsertRecommendation(ctx, db, "rec-vm-"+name, name, "Compute", "VM stopped unexpectedly: Review activity logs and start vm if required.", "High")
				} else {
					_, _ = db.ExecContext(ctx, "DELETE FROM azure_security_findings WHERE id = $1", "sec-find-vm-"+name)
					_, _ = db.ExecContext(ctx, "DELETE FROM azure_recommendations WHERE id = $1", "rec-vm-"+name)
				}
			}
		}
	}

	// 2. Query current storage accounts
	rowsSA, err := db.QueryContext(ctx, "SELECT id, name, public_network_access FROM azure_storage_accounts WHERE is_live = TRUE")
	if err == nil {
		defer rowsSA.Close()
		for rowsSA.Next() {
			var id, name, publicAccess string
			if err := rowsSA.Scan(&id, &name, &publicAccess); err == nil {
				if publicAccess == "Enabled" {
					upsertSecurityFinding(ctx, db, "sec-find-sa-"+name, "Medium", name, "Storage account allows public access. Review network firewall rules and disable anonymous access.", "Open")
					upsertRecommendation(ctx, db, "rec-sa-"+name, name, "Storage", "Storage account publicly accessible: Review network rules and disable public blob access.", "Medium")
				} else {
					_, _ = db.ExecContext(ctx, "DELETE FROM azure_security_findings WHERE id = $1", "sec-find-sa-"+name)
					_, _ = db.ExecContext(ctx, "DELETE FROM azure_recommendations WHERE id = $1", "rec-sa-"+name)
				}
			}
		}
	}

	return nil
}

func upsertSecurityFinding(ctx context.Context, db *sql.DB, id, severity, resource, recommendation, status string) {
	query := `
		INSERT INTO azure_security_findings (id, severity, resource, recommendation, status)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (id) DO UPDATE SET
			severity = EXCLUDED.severity,
			resource = EXCLUDED.resource,
			recommendation = EXCLUDED.recommendation,
			status = EXCLUDED.status
	`
	_, _ = db.ExecContext(ctx, query, id, severity, resource, recommendation, status)
}

func upsertRecommendation(ctx context.Context, db *sql.DB, id, resource, category, recText, impact string) {
	query := `
		INSERT INTO azure_recommendations (id, resource, category, recommendation, impact)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (id) DO UPDATE SET
			resource = EXCLUDED.resource,
			category = EXCLUDED.category,
			recommendation = EXCLUDED.recommendation,
			impact = EXCLUDED.impact
	`
	_, _ = db.ExecContext(ctx, query, id, resource, category, recText, impact)
}
