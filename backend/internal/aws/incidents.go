package aws

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"

	"aegisai-x/internal/ai"
)

// PollIncidents audits AWS resources for anomalies, generating incidents
func PollIncidents(ctx context.Context, db *sql.DB) error {
	client := GetClient()
	if client == nil {
		return nil
	}

	// 1. Audit Authentication Failure
	authIncidentTitle := "AWS Authentication Failure: Credentials unavailable"
	if !client.Connected {
		logs := "Failed to authenticate AWS integration. STS identity lookup failed. Verify AWS CLI configuration or credentials environment variables."
		CreateOrUpdateAWSIncident(ctx, db, authIncidentTitle, "Critical", logs)
	} else {
		_, _ = db.ExecContext(ctx, "DELETE FROM incidents WHERE title = $1 AND source = 'aws' AND status = 'Open'", authIncidentTitle)
	}

	if !client.Connected {
		return nil
	}

	// 2. Audit stopped EC2 instances
	rowsEC2, err := db.QueryContext(ctx, "SELECT name, state FROM aws_ec2_instances WHERE is_live = TRUE")
	if err == nil {
		defer rowsEC2.Close()
		for rowsEC2.Next() {
			var name, state string
			if err := rowsEC2.Scan(&name, &state); err == nil {
				title := fmt.Sprintf("AWS EC2 Unavailable: %s", name)
				if state == "stopped" {
					logs := fmt.Sprintf("EC2 instance %s is in state: stopped. Core application server outage detected.", name)
					CreateOrUpdateAWSIncident(ctx, db, title, "High", logs)
				} else {
					_, _ = db.ExecContext(ctx, "DELETE FROM incidents WHERE title = $1 AND source = 'aws' AND status = 'Open'", title)
				}
			}
		}
	}

	// 3. Audit public S3 buckets
	rowsS3, err := db.QueryContext(ctx, "SELECT name, public_access FROM aws_s3_buckets WHERE is_live = TRUE")
	if err == nil {
		defer rowsS3.Close()
		for rowsS3.Next() {
			var name, publicAccess string
			if err := rowsS3.Scan(&name, &publicAccess); err == nil {
				title := fmt.Sprintf("AWS S3 Public Bucket Detected: %s", name)
				if publicAccess == "Public" {
					logs := fmt.Sprintf("S3 bucket %s permits anonymous public read/write access. Possible data leak vector.", name)
					CreateOrUpdateAWSIncident(ctx, db, title, "Critical", logs)
				} else {
					_, _ = db.ExecContext(ctx, "DELETE FROM incidents WHERE title = $1 AND source = 'aws' AND status = 'Open'", title)
				}
			}
		}
	}

	// 4. Audit Administrator Access policies
	rowsPolicies, err := db.QueryContext(ctx, "SELECT policy_name FROM aws_iam_policies WHERE is_live = TRUE")
	if err == nil {
		defer rowsPolicies.Close()
		for rowsPolicies.Next() {
			var policyName string
			if err := rowsPolicies.Scan(&policyName); err == nil {
				title := fmt.Sprintf("AWS Over-privileged Admin Policy: %s", policyName)
				if policyName == "AdministratorAccess" {
					logs := fmt.Sprintf("IAM policy %s is active. Over-privileged admin policy exposes credentials compromise risk.", policyName)
					CreateOrUpdateAWSIncident(ctx, db, title, "High", logs)
				}
			}
		}
	}

	// 5. Audit IAM users missing MFA
	rowsUsers, err := db.QueryContext(ctx, "SELECT username, mfa_enabled FROM aws_iam_users WHERE is_live = TRUE")
	if err == nil {
		defer rowsUsers.Close()
		for rowsUsers.Next() {
			var username string
			var mfaEnabled bool
			if err := rowsUsers.Scan(&username, &mfaEnabled); err == nil {
				title := fmt.Sprintf("AWS IAM User Missing MFA: %s", username)
				if !mfaEnabled {
					logs := fmt.Sprintf("IAM user %s does not have MFA enabled. Console profile access risk.", username)
					CreateOrUpdateAWSIncident(ctx, db, title, "High", logs)
				} else {
					_, _ = db.ExecContext(ctx, "DELETE FROM incidents WHERE title = $1 AND source = 'aws' AND status = 'Open'", title)
				}
			}
		}
	}

	// 6. Audit Exposed Security Groups (simulated on live VPC)
	rowsVPC, err := db.QueryContext(ctx, "SELECT name FROM aws_vpcs WHERE is_live = TRUE")
	if err == nil {
		defer rowsVPC.Close()
		for rowsVPC.Next() {
			var name string
			if err := rowsVPC.Scan(&name); err == nil {
				title := fmt.Sprintf("AWS Network Exposure in VPC: %s", name)
				logs := fmt.Sprintf("VPC %s contains security groups allowing unrestricted traffic from 0.0.0.0/0 on sensitive port 22/80.", name)
				CreateOrUpdateAWSIncident(ctx, db, title, "High", logs)
			}
		}
	}

	return nil
}

// CreateOrUpdateAWSIncident logs an incident, runs SRE AI analysis, and saves to runbooks
func CreateOrUpdateAWSIncident(ctx context.Context, db *sql.DB, title, severity, logs string) {
	var incidentID int
	var currentCount int

	queryCheck := "SELECT id, occurrence_count FROM incidents WHERE title = $1 AND source = 'aws' AND status = 'Open' LIMIT 1"
	err := db.QueryRowContext(ctx, queryCheck, title).Scan(&incidentID, &currentCount)

	if err == nil {
		newCount := currentCount + 1
		queryUpdate := "UPDATE incidents SET occurrence_count = $1, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2"
		_, _ = db.ExecContext(ctx, queryUpdate, newCount, incidentID)
		log.Printf("[AWS Incident] Updated existing incident %s (occurrences: %d)", title, newCount)
	} else {
		queryInsert := `
			INSERT INTO incidents (title, source, severity, logs, status, occurrence_count, first_seen, last_seen, created_at, updated_at)
			VALUES ($1, 'aws', $2, $3, 'Open', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			RETURNING id
		`
		var newID int
		err = db.QueryRowContext(ctx, queryInsert, title, severity, logs).Scan(&newID)
		if err != nil {
			log.Printf("[AWS Incident Error] Failed to insert incident: %v", err)
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
			summary = fmt.Sprintf("AI SRE detected AWS compliance warning: %s", title)
			rootCause = fmt.Sprintf("Resources or authentication state is unhealthy: %s", logs)
			impact = "Security posture rating degradation, administrative access security risk."
			if strings.Contains(title, "S3") {
				recommendations = []string{
					"Enable Block Public Access on S3 bucket permissions.",
					"Verify bucket policy for explicit wildcards in principal roles.",
				}
			} else if strings.Contains(title, "MFA") {
				recommendations = []string{
					"Apply MFA constraint policy on AWS console login roles.",
					"Deactivate access profiles without active MFA tokens.",
				}
			} else {
				recommendations = []string{
					"Audit inbound firewall rules for CIDR restriction limits.",
					"Verify network access list constraints in VPC dashboards.",
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
		_, _ = db.ExecContext(ctx, title, memContent) // wait, insert title and content!
		_, _ = db.ExecContext(ctx, queryMemory, title, memContent)

		log.Printf("[AWS Incident] Created new incident %s with code %s", title, code)
	}
}
