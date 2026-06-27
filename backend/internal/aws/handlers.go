package aws

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"aegisai-x/internal/database/postgres"

	"github.com/gin-gonic/gin"
)

// GetAWSStatus serves GET /aws/status
func GetAWSStatus(c *gin.Context) {
	client := GetClient()
	wasConnected := false
	if client != nil {
		wasConnected = client.Connected
	}

	// Trigger dynamic authentication re-check on request
	InitClient(c.Request.Context())

	newClient := GetClient()
	if newClient == nil {
		c.JSON(http.StatusOK, AWSStatus{
			Connected:   false,
			Error:       "AWS client not initialized",
			LastUpdated: time.Now(),
		})
		return
	}

	// Immediate resource sync on state transition from disconnected to connected
	if newClient.Connected && !wasConnected {
		log.Println("[AWS] Transitioned to Connected state. Triggering immediate background sync...")
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
			defer cancel()
			_ = PollResources(ctx, postgres.DB)
			_ = PollSecurity(ctx, postgres.DB)
			_ = PollIncidents(ctx, postgres.DB)
		}()
	}

	var systemMode string
	_ = postgres.DB.QueryRowContext(c.Request.Context(), "SELECT value FROM platform_settings WHERE key = 'system_mode'").Scan(&systemMode)
	if systemMode == "" {
		systemMode = "DEMO"
	}

	isConnected := newClient.Connected
	if systemMode == "DEMO" {
		isConnected = false
	}

	c.JSON(http.StatusOK, AWSStatus{
		Connected:   isConnected,
		AccountID:   newClient.AccountID,
		AuthSource:  newClient.AuthSource,
		Error:       newClient.LastError,
		LastUpdated: newClient.LastUpdated,
	})
}

// GetAWSAccount serves GET /aws/account
func GetAWSAccount(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT id, arn, user_id, is_live FROM aws_accounts")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []Account{}
	for rows.Next() {
		var a Account
		if err := rows.Scan(&a.ID, &a.ARN, &a.UserID, &a.IsLive); err == nil {
			list = append(list, a)
		}
	}
	c.JSON(http.StatusOK, list)
}

// GetAWSRegions serves GET /aws/regions
func GetAWSRegions(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT name, is_live FROM aws_regions")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []Region{}
	for rows.Next() {
		var r Region
		if err := rows.Scan(&r.Name, &r.IsLive); err == nil {
			list = append(list, r)
		}
	}
	c.JSON(http.StatusOK, list)
}

// GetAWSEC2 serves GET /aws/ec2
func GetAWSEC2(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT id, name, region, state, instance_type, tags, is_live FROM aws_ec2_instances")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []EC2Instance{}
	for rows.Next() {
		var vm EC2Instance
		var tagsStr string
		if err := rows.Scan(&vm.ID, &vm.Name, &vm.Region, &vm.State, &vm.InstanceType, &tagsStr, &vm.IsLive); err == nil {
			_ = json.Unmarshal([]byte(tagsStr), &vm.Tags)
			if vm.Tags == nil {
				vm.Tags = make(map[string]string)
			}
			list = append(list, vm)
		}
	}
	c.JSON(http.StatusOK, list)
}

// GetAWSS3 serves GET /aws/s3
func GetAWSS3(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT name, region, public_access, is_live FROM aws_s3_buckets")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []S3Bucket{}
	for rows.Next() {
		var b S3Bucket
		if err := rows.Scan(&b.Name, &b.Region, &b.PublicAccess, &b.IsLive); err == nil {
			list = append(list, b)
		}
	}
	c.JSON(http.StatusOK, list)
}

// GetAWSVPC serves GET /aws/vpc
func GetAWSVPC(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT id, name, region, state, cidr_block, is_live FROM aws_vpcs")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []VPC{}
	for rows.Next() {
		var v VPC
		if err := rows.Scan(&v.ID, &v.Name, &v.Region, &v.State, &v.CidrBlock, &v.IsLive); err == nil {
			list = append(list, v)
		}
	}
	c.JSON(http.StatusOK, list)
}

// GetAWSIAM serves GET /aws/iam
func GetAWSIAM(c *gin.Context) {
	// Query users
	rowsUsers, err := postgres.DB.Query("SELECT arn, username, mfa_enabled, last_login, is_live FROM aws_iam_users")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rowsUsers.Close()
	users := []IAMUser{}
	for rowsUsers.Next() {
		var u IAMUser
		var lastLogin sql.NullTime
		if err := rowsUsers.Scan(&u.ARN, &u.Username, &u.MFAEnabled, &lastLogin, &u.IsLive); err == nil {
			if lastLogin.Valid {
				u.LastLogin = &lastLogin.Time
			}
			users = append(users, u)
		}
	}

	// Query roles
	rowsRoles, err := postgres.DB.Query("SELECT arn, role_name, is_live FROM aws_iam_roles")
	roles := []IAMRole{}
	if err == nil {
		defer rowsRoles.Close()
		for rowsRoles.Next() {
			var r IAMRole
			if err := rowsRoles.Scan(&r.ARN, &r.RoleName, &r.IsLive); err == nil {
				roles = append(roles, r)
			}
		}
	}

	// Query policies
	rowsPolicies, err := postgres.DB.Query("SELECT arn, policy_name, is_live FROM aws_iam_policies")
	policies := []IAMPolicy{}
	if err == nil {
		defer rowsPolicies.Close()
		for rowsPolicies.Next() {
			var p IAMPolicy
			if err := rowsPolicies.Scan(&p.ARN, &p.PolicyName, &p.IsLive); err == nil {
				policies = append(policies, p)
			}
		}
	}

	// Query access keys
	rowsKeys, err := postgres.DB.Query("SELECT access_key_id, username, status, last_used_date, is_live FROM aws_iam_access_keys")
	keys := []IAMAccessKey{}
	if err == nil {
		defer rowsKeys.Close()
		for rowsKeys.Next() {
			var k IAMAccessKey
			var lastUsed sql.NullTime
			if err := rowsKeys.Scan(&k.AccessKeyID, &k.Username, &k.Status, &lastUsed, &k.IsLive); err == nil {
				if lastUsed.Valid {
					k.LastUsedDate = &lastUsed.Time
				}
				keys = append(keys, k)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"users":      users,
		"roles":      roles,
		"policies":   policies,
		"accessKeys": keys,
	})
}

// GetAWSResources serves GET /aws/resources (Unified Explorer list)
func GetAWSResources(c *gin.Context) {
	list := []AWSResource{}

	// EC2 Instances
	rowsEC2, err := postgres.DB.Query("SELECT id, name, region, state, is_live FROM aws_ec2_instances")
	if err == nil {
		defer rowsEC2.Close()
		for rowsEC2.Next() {
			var r AWSResource
			r.Type = "EC2 Instance"
			if err := rowsEC2.Scan(&r.ID, &r.Name, &r.Region, &r.Status, &r.IsLive); err == nil {
				list = append(list, r)
			}
		}
	}

	// S3 Buckets
	rowsS3, err := postgres.DB.Query("SELECT name, region, public_access, is_live FROM aws_s3_buckets")
	if err == nil {
		defer rowsS3.Close()
		for rowsS3.Next() {
			var r AWSResource
			r.Type = "S3 Bucket"
			if err := rowsS3.Scan(&r.ID, &r.Region, &r.Status, &r.IsLive); err == nil {
				r.Name = r.ID
				list = append(list, r)
			}
		}
	}

	// VPCs
	rowsVPC, err := postgres.DB.Query("SELECT id, name, region, state, is_live FROM aws_vpcs")
	if err == nil {
		defer rowsVPC.Close()
		for rowsVPC.Next() {
			var r AWSResource
			r.Type = "VPC"
			if err := rowsVPC.Scan(&r.ID, &r.Name, &r.Region, &r.Status, &r.IsLive); err == nil {
				list = append(list, r)
			}
		}
	}

	// IAM Users
	rowsUsers, err := postgres.DB.Query("SELECT username, is_live FROM aws_iam_users")
	if err == nil {
		defer rowsUsers.Close()
		for rowsUsers.Next() {
			var r AWSResource
			r.Type = "IAM User"
			r.Region = "Global"
			r.Status = "Active"
			if err := rowsUsers.Scan(&r.Name, &r.IsLive); err == nil {
				r.ID = "arn:aws:iam::user/" + r.Name
				list = append(list, r)
			}
		}
	}

	c.JSON(http.StatusOK, list)
}

// GetAWSSecurity serves GET /aws/security
func GetAWSSecurity(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT id, severity, resource, recommendation, status FROM aws_security_findings")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []SecurityFinding{}
	for rows.Next() {
		var f SecurityFinding
		if err := rows.Scan(&f.ID, &f.Severity, &f.Resource, &f.Recommendation, &f.Status); err == nil {
			list = append(list, f)
		}
	}
	c.JSON(http.StatusOK, list)
}

// GetAWSRecommendations serves GET /aws/recommendations
func GetAWSRecommendations(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT id, resource, category, recommendation, impact FROM aws_recommendations")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []Recommendation{}
	for rows.Next() {
		var r Recommendation
		if err := rows.Scan(&r.ID, &r.Resource, &r.Category, &r.Recommendation, &r.Impact); err == nil {
			list = append(list, r)
		}
	}
	c.JSON(http.StatusOK, list)
}
