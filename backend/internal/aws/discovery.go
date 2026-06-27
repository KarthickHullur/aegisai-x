package aws

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"
)

// PollResources discovers AWS resources and updates DB
func PollResources(ctx context.Context, db *sql.DB) error {
	client := GetClient()
	if client == nil || !client.Connected {
		// Degraded mode: mock data remains active in the DB
		return nil
	}

	log.Println("[AWS] Discovering resources...")

	// 1. Discover Account Details
	accountID := client.AccountID
	if accountID != "" {
		arn := fmt.Sprintf("arn:aws:iam::%s:root", accountID)
		_, _ = db.ExecContext(ctx, 
			"INSERT INTO aws_accounts (id, arn, user_id, is_live) VALUES ($1, $2, 'root', TRUE) "+
			"ON CONFLICT (id) DO UPDATE SET arn = EXCLUDED.arn, user_id = EXCLUDED.user_id, is_live = EXCLUDED.is_live",
			accountID, arn)
	}

	// 2. Discover Regions
	regions, err := discoverRegions(ctx)
	if err == nil {
		_, _ = db.ExecContext(ctx, "DELETE FROM aws_regions WHERE is_live = TRUE")
		for _, r := range regions {
			_, _ = db.ExecContext(ctx, 
				"INSERT INTO aws_regions (name, is_live) VALUES ($1, TRUE) "+
				"ON CONFLICT (name, is_live) DO NOTHING",
				r)
		}
	} else {
		log.Printf("[AWS Discovery Warning] Regions lookup failed: %v", err)
	}

	// 3. Discover VPCs
	vpcs, err := discoverVPCs(ctx)
	if err == nil {
		_, _ = db.ExecContext(ctx, "DELETE FROM aws_vpcs WHERE is_live = TRUE")
		for _, v := range vpcs {
			_, _ = db.ExecContext(ctx, 
				"INSERT INTO aws_vpcs (id, name, region, state, cidr_block, is_live) VALUES ($1, $2, $3, $4, $5, TRUE) "+
				"ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, region = EXCLUDED.region, state = EXCLUDED.state, cidr_block = EXCLUDED.cidr_block, is_live = EXCLUDED.is_live",
				v.ID, v.Name, v.Region, v.State, v.CidrBlock)
		}
	} else {
		log.Printf("[AWS Discovery Warning] VPC lookup failed: %v", err)
	}

	// 4. Discover EC2 Instances
	vms, err := discoverEC2(ctx)
	if err == nil {
		_, _ = db.ExecContext(ctx, "DELETE FROM aws_ec2_instances WHERE is_live = TRUE")
		for _, vm := range vms {
			tagsBytes, _ := json.Marshal(vm.Tags)
			_, _ = db.ExecContext(ctx, 
				"INSERT INTO aws_ec2_instances (id, name, region, state, instance_type, tags, is_live) VALUES ($1, $2, $3, $4, $5, $6, TRUE) "+
				"ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, region = EXCLUDED.region, state = EXCLUDED.state, instance_type = EXCLUDED.instance_type, tags = EXCLUDED.tags, is_live = EXCLUDED.is_live",
				vm.ID, vm.Name, vm.Region, vm.State, vm.InstanceType, string(tagsBytes))
		}
	} else {
		log.Printf("[AWS Discovery Warning] EC2 lookup failed: %v", err)
	}

	// 5. Discover S3 Buckets
	buckets, err := discoverS3(ctx)
	if err == nil {
		_, _ = db.ExecContext(ctx, "DELETE FROM aws_s3_buckets WHERE is_live = TRUE")
		for _, b := range buckets {
			_, _ = db.ExecContext(ctx, 
				"INSERT INTO aws_s3_buckets (name, region, public_access, is_live) VALUES ($1, $2, $3, TRUE) "+
				"ON CONFLICT (name, is_live) DO UPDATE SET region = EXCLUDED.region, public_access = EXCLUDED.public_access, is_live = EXCLUDED.is_live",
				b.Name, b.Region, b.PublicAccess)
		}
	} else {
		log.Printf("[AWS Discovery Warning] S3 lookup failed: %v", err)
	}

	// 6. Discover IAM details (Users, Roles, Policies, Keys)
	log.Println("[AWS] IAM discovery started.")
	users, roles, policies, keys, err := discoverIAM(ctx)
	if err == nil {
		// Users
		_, _ = db.ExecContext(ctx, "DELETE FROM aws_iam_users WHERE is_live = TRUE")
		for _, u := range users {
			var lastLoginVal interface{} = nil
			if u.LastLogin != nil {
				lastLoginVal = *u.LastLogin
			}
			_, _ = db.ExecContext(ctx, 
				"INSERT INTO aws_iam_users (arn, username, mfa_enabled, last_login, is_live) VALUES ($1, $2, $3, $4, TRUE) "+
				"ON CONFLICT (arn) DO UPDATE SET username = EXCLUDED.username, mfa_enabled = EXCLUDED.mfa_enabled, last_login = EXCLUDED.last_login, is_live = EXCLUDED.is_live",
				u.ARN, u.Username, u.MFAEnabled, lastLoginVal)
		}

		// Roles
		_, _ = db.ExecContext(ctx, "DELETE FROM aws_iam_roles WHERE is_live = TRUE")
		for _, r := range roles {
			_, _ = db.ExecContext(ctx, 
				"INSERT INTO aws_iam_roles (arn, role_name, is_live) VALUES ($1, $2, TRUE) "+
				"ON CONFLICT (arn) DO UPDATE SET role_name = EXCLUDED.role_name, is_live = EXCLUDED.is_live",
				r.ARN, r.RoleName)
		}

		// Policies
		_, _ = db.ExecContext(ctx, "DELETE FROM aws_iam_policies WHERE is_live = TRUE")
		for _, p := range policies {
			_, _ = db.ExecContext(ctx, 
				"INSERT INTO aws_iam_policies (arn, policy_name, is_live) VALUES ($1, $2, TRUE) "+
				"ON CONFLICT (arn) DO UPDATE SET policy_name = EXCLUDED.policy_name, is_live = EXCLUDED.is_live",
				p.ARN, p.PolicyName)
		}

		// Access Keys
		_, _ = db.ExecContext(ctx, "DELETE FROM aws_iam_access_keys WHERE is_live = TRUE")
		for _, k := range keys {
			var lastUsedVal interface{} = nil
			if k.LastUsedDate != nil {
				lastUsedVal = *k.LastUsedDate
			}
			_, _ = db.ExecContext(ctx, 
				"INSERT INTO aws_iam_access_keys (access_key_id, username, status, last_used_date, is_live) VALUES ($1, $2, $3, $4, TRUE) "+
				"ON CONFLICT (access_key_id) DO UPDATE SET username = EXCLUDED.username, status = EXCLUDED.status, last_used_date = EXCLUDED.last_used_date, is_live = EXCLUDED.is_live",
				k.AccessKeyID, k.Username, k.Status, lastUsedVal)
		}
	} else {
		log.Printf("[AWS Discovery Warning] IAM lookup failed: %v", err)
	}

	return nil
}

func discoverRegions(ctx context.Context) ([]string, error) {
	awsPath := GetAWSPath()
	cmd := exec.CommandContext(ctx, awsPath, "ec2", "describe-regions", "--query", "Regions[].RegionName", "--output", "json")
	cmd.Env = os.Environ()
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var regions []string
	if err := json.Unmarshal(out, &regions); err != nil {
		return nil, err
	}
	return regions, nil
}

func discoverVPCs(ctx context.Context) ([]VPC, error) {
	awsPath := GetAWSPath()
	cmd := exec.CommandContext(ctx, awsPath, "ec2", "describe-vpcs", "--query", "Vpcs[]", "--output", "json")
	cmd.Env = os.Environ()
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var raw []struct {
		VpcID     string `json:"VpcId"`
		CidrBlock string `json:"CidrBlock"`
		State     string `json:"State"`
		Tags      []struct {
			Key   string `json:"Key"`
			Value string `json:"Value"`
		} `json:"Tags"`
	}
	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, err
	}

	var vpcs []VPC
	for _, r := range raw {
		name := r.VpcID
		for _, t := range r.Tags {
			if t.Key == "Name" {
				name = t.Value
				break
			}
		}
		region := os.Getenv("AWS_REGION")
		if region == "" {
			region = "us-east-1"
		}
		vpcs = append(vpcs, VPC{
			ID:        r.VpcID,
			Name:      name,
			Region:    region,
			State:     r.State,
			CidrBlock: r.CidrBlock,
		})
	}
	return vpcs, nil
}

func discoverEC2(ctx context.Context) ([]EC2Instance, error) {
	awsPath := GetAWSPath()
	cmd := exec.CommandContext(ctx, awsPath, "ec2", "describe-instances", "--query", "Reservations[].Instances[]", "--output", "json")
	cmd.Env = os.Environ()
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var raw []struct {
		InstanceID   string `json:"InstanceId"`
		InstanceType string `json:"InstanceType"`
		State        struct {
			Name string `json:"Name"`
		} `json:"State"`
		Placement struct {
			AvailabilityZone string `json:"AvailabilityZone"`
		} `json:"Placement"`
		Tags []struct {
			Key   string `json:"Key"`
			Value string `json:"Value"`
		} `json:"Tags"`
	}
	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, err
	}

	var vms []EC2Instance
	for _, r := range raw {
		name := r.InstanceID
		tagsMap := make(map[string]string)
		for _, t := range r.Tags {
			tagsMap[t.Key] = t.Value
			if t.Key == "Name" {
				name = t.Value
			}
		}
		region := r.Placement.AvailabilityZone
		if len(region) > 0 {
			region = region[:len(region)-1] // Remove AZ letter to get region
		}
		vms = append(vms, EC2Instance{
			ID:           r.InstanceID,
			Name:         name,
			Region:       region,
			State:        r.State.Name,
			InstanceType: r.InstanceType,
			Tags:         tagsMap,
		})
	}
	return vms, nil
}

func discoverS3(ctx context.Context) ([]S3Bucket, error) {
	awsPath := GetAWSPath()
	cmd := exec.CommandContext(ctx, awsPath, "s3api", "list-buckets", "--query", "Buckets[].Name", "--output", "json")
	cmd.Env = os.Environ()
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var names []string
	if err := json.Unmarshal(out, &names); err != nil {
		return nil, err
	}

	var buckets []S3Bucket
	for _, name := range names {
		// Get Bucket Location
		locCmd := exec.CommandContext(ctx, awsPath, "s3api", "get-bucket-location", "--bucket", name, "--query", "LocationConstraint", "--output", "text")
		locCmd.Env = os.Environ()
		locOut, locErr := locCmd.Output()
		region := strings.TrimSpace(string(locOut))
		if locErr != nil || region == "" || region == "None" {
			region = "us-east-1"
		}

		// Check Public Access Block
		pubCmd := exec.CommandContext(ctx, awsPath, "s3api", "get-public-access-block", "--bucket", name, "--output", "json")
		pubCmd.Env = os.Environ()
		pubAccess := "Public"
		if pubErr := pubCmd.Run(); pubErr == nil {
			pubAccess = "Blocked"
		}

		buckets = append(buckets, S3Bucket{
			Name:         name,
			Region:       region,
			PublicAccess: pubAccess,
		})
	}
	return buckets, nil
}

func discoverIAM(ctx context.Context) ([]IAMUser, []IAMRole, []IAMPolicy, []IAMAccessKey, error) {
	awsPath := GetAWSPath()

	// 1. Discover Users
	cmdUsers := exec.CommandContext(ctx, awsPath, "iam", "list-users", "--query", "Users[]", "--output", "json")
	cmdUsers.Env = os.Environ()
	outUsers, err := cmdUsers.Output()
	if err != nil {
		return nil, nil, nil, nil, err
	}
	var rawUsers []struct {
		Arn              string  `json:"Arn"`
		UserName         string  `json:"UserName"`
		PasswordLastUsed *string `json:"PasswordLastUsed"`
	}
	_ = json.Unmarshal(outUsers, &rawUsers)

	var users []IAMUser
	var keys []IAMAccessKey
	policyMap := make(map[string]IAMPolicy)

	for _, ru := range rawUsers {
		var lastLogin *time.Time
		if ru.PasswordLastUsed != nil {
			t, err := time.Parse(time.RFC3339, *ru.PasswordLastUsed)
			if err == nil {
				lastLogin = &t
			}
		}

		// Check MFA Devices
		cmdMfa := exec.CommandContext(ctx, awsPath, "iam", "list-mfa-devices", "--user-name", ru.UserName, "--query", "MFADevices[]", "--output", "json")
		cmdMfa.Env = os.Environ()
		mfaEnabled := false
		if outMfa, mfaErr := cmdMfa.Output(); mfaErr == nil {
			var mfaDevices []interface{}
			if err := json.Unmarshal(outMfa, &mfaDevices); err == nil && len(mfaDevices) > 0 {
				mfaEnabled = true
			}
		}

		users = append(users, IAMUser{
			ARN:        ru.Arn,
			Username:   ru.UserName,
			MFAEnabled: mfaEnabled,
			LastLogin:  lastLogin,
		})

		// List Access Keys
		cmdKeys := exec.CommandContext(ctx, awsPath, "iam", "list-access-keys", "--user-name", ru.UserName, "--query", "AccessKeyMetadata[]", "--output", "json")
		cmdKeys.Env = os.Environ()
		if outKeys, keysErr := cmdKeys.Output(); keysErr == nil {
			var rawKeys []struct {
				AccessKeyId string `json:"AccessKeyId"`
				Status      string `json:"Status"`
			}
			if err := json.Unmarshal(outKeys, &rawKeys); err == nil {
				for _, rk := range rawKeys {
					// Get Last Used Date
					cmdLastUsed := exec.CommandContext(ctx, awsPath, "iam", "get-access-key-last-used", "--access-key-id", rk.AccessKeyId, "--query", "AccessKeyLastUsed.LastUsedDate", "--output", "json")
					cmdLastUsed.Env = os.Environ()
					var keyLastUsed *time.Time
					if outLastUsed, lastUsedErr := cmdLastUsed.Output(); lastUsedErr == nil {
						var lastUsedStr string
						if err := json.Unmarshal(outLastUsed, &lastUsedStr); err == nil && lastUsedStr != "" {
							if t, err := time.Parse(time.RFC3339, lastUsedStr); err == nil {
								keyLastUsed = &t
							}
						}
					}
					keys = append(keys, IAMAccessKey{
						AccessKeyID:  rk.AccessKeyId,
						Username:     ru.UserName,
						Status:       rk.Status,
						LastUsedDate: keyLastUsed,
					})
				}
			}
		}

		// List Attached User Policies
		cmdUserPolicies := exec.CommandContext(ctx, awsPath, "iam", "list-attached-user-policies", "--user-name", ru.UserName, "--query", "AttachedPolicies[]", "--output", "json")
		cmdUserPolicies.Env = os.Environ()
		if outUserPolicies, err := cmdUserPolicies.Output(); err == nil {
			var rawPol []struct {
				PolicyName string `json:"PolicyName"`
				PolicyArn  string `json:"PolicyArn"`
			}
			if err := json.Unmarshal(outUserPolicies, &rawPol); err == nil {
				for _, p := range rawPol {
					policyMap[p.PolicyArn] = IAMPolicy{
						ARN:        p.PolicyArn,
						PolicyName: p.PolicyName,
					}
				}
			}
		}
	}

	// 2. Discover Roles
	cmdRoles := exec.CommandContext(ctx, awsPath, "iam", "list-roles", "--query", "Roles[].{Arn:Arn, RoleName:RoleName}", "--output", "json")
	cmdRoles.Env = os.Environ()
	var roles []IAMRole
	if outRoles, err := cmdRoles.Output(); err == nil {
		var rawRoles []struct {
			Arn      string `json:"Arn"`
			RoleName string `json:"RoleName"`
		}
		if err := json.Unmarshal(outRoles, &rawRoles); err == nil {
			for _, rr := range rawRoles {
				roles = append(roles, IAMRole{
					ARN:      rr.Arn,
					RoleName: rr.RoleName,
				})

				// List Attached Role Policies
				cmdRolePolicies := exec.CommandContext(ctx, awsPath, "iam", "list-attached-role-policies", "--role-name", rr.RoleName, "--query", "AttachedPolicies[]", "--output", "json")
				cmdRolePolicies.Env = os.Environ()
				if outRolePolicies, err := cmdRolePolicies.Output(); err == nil {
					var rawPol []struct {
						PolicyName string `json:"PolicyName"`
						PolicyArn  string `json:"PolicyArn"`
					}
					if err := json.Unmarshal(outRolePolicies, &rawPol); err == nil {
						for _, p := range rawPol {
							policyMap[p.PolicyArn] = IAMPolicy{
								ARN:        p.PolicyArn,
								PolicyName: p.PolicyName,
							}
						}
					}
				}
			}
		}
	}

	// 3. Discover Local Policies
	cmdPolicies := exec.CommandContext(ctx, awsPath, "iam", "list-policies", "--scope", "Local", "--query", "Policies[].{Arn:Arn, PolicyName:PolicyName}", "--output", "json")
	cmdPolicies.Env = os.Environ()
	if outPolicies, err := cmdPolicies.Output(); err == nil {
		var rawPolicies []struct {
			Arn        string `json:"Arn"`
			PolicyName string `json:"PolicyName"`
		}
		if err := json.Unmarshal(outPolicies, &rawPolicies); err == nil {
			for _, rp := range rawPolicies {
				policyMap[rp.Arn] = IAMPolicy{
					ARN:        rp.Arn,
					PolicyName: rp.PolicyName,
				}
			}
		}
	}

	var policies []IAMPolicy
	for _, p := range policyMap {
		policies = append(policies, p)
	}

	return users, roles, policies, keys, nil
}
