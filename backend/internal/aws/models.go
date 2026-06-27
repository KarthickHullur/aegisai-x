package aws

import "time"

type AWSStatus struct {
	Connected   bool      `json:"connected"`
	AccountID   string    `json:"accountId"`
	AuthSource  string    `json:"authSource"`
	Error       string    `json:"error"`
	LastUpdated time.Time `json:"lastUpdated"`
}

type Account struct {
	ID     string `json:"id"`
	ARN    string `json:"arn"`
	UserID string `json:"userId"`
	IsLive bool   `json:"isLive"`
}

type Region struct {
	Name   string `json:"name"`
	IsLive bool   `json:"isLive"`
}

type EC2Instance struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Region       string            `json:"region"`
	State        string            `json:"state"`
	InstanceType string            `json:"instanceType"`
	Tags         map[string]string `json:"tags"`
	IsLive       bool              `json:"isLive"`
}

type S3Bucket struct {
	Name         string `json:"name"`
	Region       string `json:"region"`
	PublicAccess string `json:"publicAccess"`
	IsLive       bool   `json:"isLive"`
}

type VPC struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Region    string `json:"region"`
	State     string `json:"state"`
	CidrBlock string `json:"cidrBlock"`
	IsLive    bool   `json:"isLive"`
}

type IAMUser struct {
	ARN        string     `json:"arn"`
	Username   string     `json:"username"`
	MFAEnabled bool       `json:"mfaEnabled"`
	LastLogin  *time.Time `json:"lastLogin"`
	IsLive     bool       `json:"isLive"`
}

type IAMRole struct {
	ARN      string `json:"arn"`
	RoleName string `json:"roleName"`
	IsLive   bool   `json:"isLive"`
}

type IAMPolicy struct {
	ARN        string `json:"arn"`
	PolicyName string `json:"policyName"`
	IsLive     bool   `json:"isLive"`
}

type IAMAccessKey struct {
	AccessKeyID  string     `json:"accessKeyId"`
	Username     string     `json:"username"`
	Status       string     `json:"status"`
	LastUsedDate *time.Time `json:"lastUsedDate"`
	IsLive       bool       `json:"isLive"`
}

type AWSResource struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Type   string `json:"type"`
	Region string `json:"region"`
	Status string `json:"status"`
	IsLive bool   `json:"isLive"`
}

type SecurityFinding struct {
	ID             string `json:"id"`
	Severity       string `json:"severity"`
	Resource       string `json:"resource"`
	Recommendation string `json:"recommendation"`
	Status         string `json:"status"`
}

type Recommendation struct {
	ID             string `json:"id"`
	Resource       string `json:"resource"`
	Category       string `json:"category"`
	Recommendation string `json:"recommendation"`
	Impact         string `json:"impact"`
}
