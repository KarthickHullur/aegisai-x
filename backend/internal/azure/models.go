package azure

import "time"

type AzureStatus struct {
	Connected    bool      `json:"connected"`
	Subscription string    `json:"subscription"`
	Error        string    `json:"error"`
	LastUpdated  time.Time `json:"lastUpdated"`
}

type Subscription struct {
	ID          string `json:"id"`
	SubID       string `json:"subscriptionId"`
	DisplayName string `json:"displayName"`
	State       string `json:"state"`
	IsLive      bool   `json:"isLive"`
}

type ResourceGroup struct {
	ID                string            `json:"id"`
	Name              string            `json:"name"`
	Location          string            `json:"location"`
	ProvisioningState string            `json:"provisioningState"`
	Tags              map[string]string `json:"tags"`
	IsLive            bool              `json:"isLive"`
}

type VirtualMachine struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Location string `json:"location"`
	Status   string `json:"status"`
	Size     string `json:"size"`
	OsType   string `json:"osType"`
	IsLive   bool   `json:"isLive"`
}

type StorageAccount struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	Location            string `json:"location"`
	Status              string `json:"status"`
	Sku                 string `json:"sku"`
	AccessTier          string `json:"accessTier"`
	PublicNetworkAccess string `json:"publicNetworkAccess"`
	IsLive              bool   `json:"isLive"`
}

type AKSCluster struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Location  string `json:"location"`
	Status    string `json:"status"`
	Version   string `json:"version"`
	NodeCount int    `json:"nodeCount"`
	IsLive    bool   `json:"isLive"`
}

type AzureResource struct {
	ID       string            `json:"id"`
	Name     string            `json:"name"`
	Type     string            `json:"type"`
	Location string            `json:"location"`
	Tags     map[string]string `json:"tags"`
	Status   string            `json:"status"`
	IsLive   bool              `json:"isLive"`
}

type Cost struct {
	Date          time.Time `json:"date"`
	ResourceGroup string    `json:"resourceGroup"`
	Cost          float64   `json:"cost"`
	Currency      string    `json:"currency"`
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

type Provider struct {
	Namespace         string `json:"namespace"`
	RegistrationState string `json:"registrationState"`
	IsLive            bool   `json:"isLive"`
}
