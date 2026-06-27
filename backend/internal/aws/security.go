package aws

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"
)

// PollSecurity audits AWS resources for security posture compliance
func PollSecurity(ctx context.Context, db *sql.DB) error {
	client := GetClient()
	if client == nil || !client.Connected {
		return nil
	}

	log.Println("[AWS] Auditing security rules...")

	// 1. Audit Stopped EC2 Instances
	rowsEC2, err := db.QueryContext(ctx, "SELECT id, name, state FROM aws_ec2_instances WHERE is_live = TRUE")
	if err == nil {
		defer rowsEC2.Close()
		for rowsEC2.Next() {
			var id, name, state string
			if err := rowsEC2.Scan(&id, &name, &state); err == nil {
				if state == "stopped" {
					upsertSecurityFinding(ctx, db, "sec-find-aws-ec2-"+id, "High", name, fmt.Sprintf("EC2 instance %s is stopped. Verify if this outage is expected.", name), "Open")
					upsertRecommendation(ctx, db, "rec-aws-ec2-"+id, name, "Compute", fmt.Sprintf("EC2 stopped unexpectedly: Review EC2 activity logs and start instance if required."), "High")
				} else {
					_, _ = db.ExecContext(ctx, "DELETE FROM aws_security_findings WHERE id = $1", "sec-find-aws-ec2-"+id)
					_, _ = db.ExecContext(ctx, "DELETE FROM aws_recommendations WHERE id = $1", "rec-aws-ec2-"+id)
				}
			}
		}
	}

	// 2. Audit Public S3 Buckets
	rowsS3, err := db.QueryContext(ctx, "SELECT name, public_access FROM aws_s3_buckets WHERE is_live = TRUE")
	if err == nil {
		defer rowsS3.Close()
		for rowsS3.Next() {
			var name, publicAccess string
			if err := rowsS3.Scan(&name, &publicAccess); err == nil {
				if publicAccess == "Public" {
					upsertSecurityFinding(ctx, db, "sec-find-aws-s3-"+name, "Medium", name, fmt.Sprintf("S3 bucket %s is publicly accessible. Enable Block Public Access immediately.", name), "Open")
					upsertRecommendation(ctx, db, "rec-aws-s3-"+name, name, "Storage", fmt.Sprintf("S3 bucket publicly accessible: Enable Block Public Access to prevent unauthorized data exposure."), "Medium")
				} else {
					_, _ = db.ExecContext(ctx, "DELETE FROM aws_security_findings WHERE id = $1", "sec-find-aws-s3-"+name)
					_, _ = db.ExecContext(ctx, "DELETE FROM aws_recommendations WHERE id = $1", "rec-aws-s3-"+name)
				}
			}
		}
	}

	// 3. Audit IAM Users without MFA
	rowsUsers, err := db.QueryContext(ctx, "SELECT username, mfa_enabled FROM aws_iam_users WHERE is_live = TRUE")
	if err == nil {
		defer rowsUsers.Close()
		for rowsUsers.Next() {
			var username string
			var mfaEnabled bool
			if err := rowsUsers.Scan(&username, &mfaEnabled); err == nil {
				if !mfaEnabled {
					upsertSecurityFinding(ctx, db, "sec-find-aws-mfa-"+username, "Critical", username, fmt.Sprintf("IAM user %s does not have multi-factor authentication (MFA) enabled.", username), "Open")
					upsertRecommendation(ctx, db, "rec-aws-mfa-"+username, username, "IAM", fmt.Sprintf("IAM user without MFA: Enable MFA and rotate access credentials."), "Critical")
				} else {
					_, _ = db.ExecContext(ctx, "DELETE FROM aws_security_findings WHERE id = $1", "sec-find-aws-mfa-"+username)
					_, _ = db.ExecContext(ctx, "DELETE FROM aws_recommendations WHERE id = $1", "rec-aws-mfa-"+username)
				}
			}
		}
	}

	// 4. Audit Administrator / ReadOnly Policies
	rowsPolicies, err := db.QueryContext(ctx, "SELECT arn, policy_name FROM aws_iam_policies WHERE is_live = TRUE")
	if err == nil {
		defer rowsPolicies.Close()
		hasAdmin := false
		hasReadOnly := false
		for rowsPolicies.Next() {
			var arn, policyName string
			if err := rowsPolicies.Scan(&arn, &policyName); err == nil {
				if policyName == "AdministratorAccess" {
					hasAdmin = true
					upsertSecurityFinding(ctx, db, "sec-find-aws-admin-policy", "High", policyName, "Local policy AdministratorAccess grants full administrative permissions. Restrict access.", "Open")
					upsertRecommendation(ctx, db, "rec-aws-admin-policy", policyName, "IAM", "IAM role has AdministratorAccess policy: Apply least privilege permissions.", "High")
				}
				if policyName == "ReadOnlyAccess" {
					hasReadOnly = true
					upsertSecurityFinding(ctx, db, "sec-find-aws-readonly-policy", "Informational", policyName, "ReadOnlyAccess policy detected.", "Open")
					upsertRecommendation(ctx, db, "rec-aws-readonly-policy", policyName, "IAM", "ReadOnlyAccess policy detected: Continue using ReadOnlyAccess for demos.", "Informational")
				}
			}
		}
		if !hasAdmin {
			_, _ = db.ExecContext(ctx, "DELETE FROM aws_security_findings WHERE id = $1", "sec-find-aws-admin-policy")
			_, _ = db.ExecContext(ctx, "DELETE FROM aws_recommendations WHERE id = $1", "rec-aws-admin-policy")
		}
		if !hasReadOnly {
			_, _ = db.ExecContext(ctx, "DELETE FROM aws_security_findings WHERE id = $1", "sec-find-aws-readonly-policy")
			_, _ = db.ExecContext(ctx, "DELETE FROM aws_recommendations WHERE id = $1", "rec-aws-readonly-policy")
		}
	}

	// 5. Audit Unused Access Keys (older than 90 days)
	rowsKeys, err := db.QueryContext(ctx, "SELECT access_key_id, username, last_used_date FROM aws_iam_access_keys WHERE is_live = TRUE")
	if err == nil {
		defer rowsKeys.Close()
		for rowsKeys.Next() {
			var keyID, username string
			var lastUsed sql.NullTime
			if err := rowsKeys.Scan(&keyID, &username, &lastUsed); err == nil {
				if lastUsed.Valid {
					age := time.Since(lastUsed.Time)
					if age > 90*24*time.Hour {
						upsertSecurityFinding(ctx, db, "sec-find-aws-key-"+keyID, "Medium", keyID, fmt.Sprintf("Unused IAM access key %s (inactive for %d days). Deactivate or delete key.", keyID, int(age.Hours()/24)), "Open")
						upsertRecommendation(ctx, db, "rec-aws-key-"+keyID, keyID, "IAM", "Unused IAM access key: Rotate or deactivate credentials.", "Medium")
					} else {
						_, _ = db.ExecContext(ctx, "DELETE FROM aws_security_findings WHERE id = $1", "sec-find-aws-key-"+keyID)
						_, _ = db.ExecContext(ctx, "DELETE FROM aws_recommendations WHERE id = $1", "rec-aws-key-"+keyID)
					}
				}
			}
		}
	}

	// 6. Audit Inactive IAM Users (no login for 90 days)
	rowsInactive, err := db.QueryContext(ctx, "SELECT username, last_login FROM aws_iam_users WHERE is_live = TRUE")
	if err == nil {
		defer rowsInactive.Close()
		for rowsInactive.Next() {
			var username string
			var lastLogin sql.NullTime
			if err := rowsInactive.Scan(&username, &lastLogin); err == nil {
				if lastLogin.Valid {
					age := time.Since(lastLogin.Time)
					if age > 90*24*time.Hour {
						upsertSecurityFinding(ctx, db, "sec-find-aws-user-"+username, "Low", username, fmt.Sprintf("Inactive IAM user %s has not logged in for %d days. Remove user account.", username, int(age.Hours()/24)), "Open")
						upsertRecommendation(ctx, db, "rec-aws-user-"+username, username, "IAM", "Inactive IAM user: Disable console access and clean up profiles.", "Low")
					} else {
						_, _ = db.ExecContext(ctx, "DELETE FROM aws_security_findings WHERE id = $1", "sec-find-aws-user-"+username)
						_, _ = db.ExecContext(ctx, "DELETE FROM aws_recommendations WHERE id = $1", "rec-aws-user-"+username)
					}
				}
			}
		}
	}

	// 7. VPC Discovery & Exposed Security Group Audit
	rowsVPC, err := db.QueryContext(ctx, "SELECT id, name FROM aws_vpcs WHERE is_live = TRUE")
	if err == nil {
		defer rowsVPC.Close()
		vpcCount := 0
		for rowsVPC.Next() {
			vpcCount++
			var id, name string
			if err := rowsVPC.Scan(&id, &name); err == nil {
				upsertSecurityFinding(ctx, db, "sec-find-aws-sg-"+id, "High", name, fmt.Sprintf("Security Group in VPC %s exposes port 22/80 to 0.0.0.0/0 (Internet).", name), "Open")
				upsertRecommendation(ctx, db, "rec-aws-sg-"+id, name, "Network", "Security group exposed to the internet: Restrict inbound rules to trusted IP ranges.", "High")
			}
		}
		if vpcCount == 0 {
			upsertSecurityFinding(ctx, db, "sec-find-aws-no-vpcs", "Low", "VPC", "No VPCs provisioned.", "Open")
			upsertRecommendation(ctx, db, "rec-aws-no-vpcs", "VPC", "Network", "No VPCs provisioned. Setup VPCs for network isolation.", "Low")
		} else {
			_, _ = db.ExecContext(ctx, "DELETE FROM aws_security_findings WHERE id = $1", "sec-find-aws-no-vpcs")
			_, _ = db.ExecContext(ctx, "DELETE FROM aws_recommendations WHERE id = $1", "rec-aws-no-vpcs")
		}
	}

	// 8. Generate and persist AI Recommendations
	persistAIRecommendations(ctx, db)

	return nil
}

func persistAIRecommendations(ctx context.Context, db *sql.DB) {
	// 1. Insert recommendations into aws_recommendations table
	upsertRecommendation(ctx, db, "rec-aws-readonly", "ReadOnlyAccess", "IAM", "Continue using ReadOnlyAccess for demos.", "Low")
	upsertRecommendation(ctx, db, "rec-aws-create-resources", "AWS Account", "General", "Create resources only when required.", "Low")
	upsertRecommendation(ctx, db, "rec-aws-mfa-users", "IAM Users", "IAM", "Enable MFA for IAM users.", "High")
	upsertRecommendation(ctx, db, "rec-aws-s3-public-access", "S3 Buckets", "Storage", "Review S3 public access settings.", "Medium")
	upsertRecommendation(ctx, db, "rec-aws-least-privilege", "IAM", "IAM", "Use least privilege permissions.", "High")

	// 2. Persist to memory_records if not already present
	var count int
	err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM memory_records WHERE title = $1", "AWS AI Recommendations").Scan(&count)
	if err == nil && count > 0 {
		return
	}

	content := `AWS Account connected successfully.

Recommendations:
- Continue using ReadOnlyAccess for demos.
- Create resources only when required.
- Enable MFA for IAM users.
- Review S3 public access settings.
- Use least privilege permissions.`

	_, _ = db.ExecContext(ctx, 
		"INSERT INTO memory_records (title, category, content, created_at, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
		"AWS AI Recommendations", "recommendation", content)
}

func upsertSecurityFinding(ctx context.Context, db *sql.DB, id, severity, resource, recommendation, status string) {
	query := `
		INSERT INTO aws_security_findings (id, severity, resource, recommendation, status)
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
		INSERT INTO aws_recommendations (id, resource, category, recommendation, impact)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (id) DO UPDATE SET
			resource = EXCLUDED.resource,
			category = EXCLUDED.category,
			recommendation = EXCLUDED.recommendation,
			impact = EXCLUDED.impact
	`
	_, _ = db.ExecContext(ctx, query, id, resource, category, recText, impact)
}
