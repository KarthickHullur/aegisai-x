package azure

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

// GetAzureStatus serves GET /azure/status
func GetAzureStatus(c *gin.Context) {
	client := GetClient()
	wasConnected := false
	if client != nil {
		wasConnected = client.Connected
	}

	// Dynamic recheck of authentication
	InitClient(c.Request.Context())

	newClient := GetClient()
	if newClient == nil {
		c.JSON(http.StatusOK, AzureStatus{
			Connected:   false,
			Error:       "Azure client not initialized",
			LastUpdated: time.Now(),
		})
		return
	}

	// Trigger immediate resource sync on state transition from disconnected to connected
	if newClient.Connected && !wasConnected {
		log.Println("[Azure] Transitioned to Connected state. Triggering immediate background sync...")
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
			defer cancel()
			_ = PollResources(ctx, postgres.DB)
			_ = PollMetrics(ctx, postgres.DB)
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

	c.JSON(http.StatusOK, AzureStatus{
		Connected:    isConnected,
		Subscription: newClient.Subscription,
		Error:        newClient.LastError,
		LastUpdated:  newClient.LastUpdated,
	})
}

// GetAzureSubscriptions serves GET /azure/subscriptions
func GetAzureSubscriptions(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT id, subscription_id, display_name, state, is_live FROM azure_subscriptions")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []Subscription{}
	for rows.Next() {
		var s Subscription
		if err := rows.Scan(&s.ID, &s.SubID, &s.DisplayName, &s.State, &s.IsLive); err == nil {
			list = append(list, s)
		}
	}
	c.JSON(http.StatusOK, list)
}

// GetAzureResourceGroups serves GET /azure/resource-groups
func GetAzureResourceGroups(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT id, name, location, provisioning_state, tags, is_live FROM azure_resource_groups")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []ResourceGroup{}
	for rows.Next() {
		var rg ResourceGroup
		var tagsStr sql.NullString
		if err := rows.Scan(&rg.ID, &rg.Name, &rg.Location, &rg.ProvisioningState, &tagsStr, &rg.IsLive); err == nil {
			if tagsStr.Valid && tagsStr.String != "" {
				_ = json.Unmarshal([]byte(tagsStr.String), &rg.Tags)
			}
			if rg.Tags == nil {
				rg.Tags = make(map[string]string)
			}
			list = append(list, rg)
		}
	}
	c.JSON(http.StatusOK, list)
}

// GetAzureProviders serves GET /azure/providers
func GetAzureProviders(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT namespace, registration_state, is_live FROM azure_providers")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []Provider{}
	for rows.Next() {
		var p Provider
		if err := rows.Scan(&p.Namespace, &p.RegistrationState, &p.IsLive); err == nil {
			list = append(list, p)
		}
	}
	c.JSON(http.StatusOK, list)
}

// GetAzureVMs serves GET /azure/vms
func GetAzureVMs(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT id, name, location, status, size, os_type, is_live FROM azure_vms")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []VirtualMachine{}
	for rows.Next() {
		var vm VirtualMachine
		if err := rows.Scan(&vm.ID, &vm.Name, &vm.Location, &vm.Status, &vm.Size, &vm.OsType, &vm.IsLive); err == nil {
			list = append(list, vm)
		}
	}
	c.JSON(http.StatusOK, list)
}

// GetAzureStorage serves GET /azure/storage
func GetAzureStorage(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT id, name, location, status, sku, access_tier, public_network_access, is_live FROM azure_storage_accounts")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []StorageAccount{}
	for rows.Next() {
		var sa StorageAccount
		if err := rows.Scan(&sa.ID, &sa.Name, &sa.Location, &sa.Status, &sa.Sku, &sa.AccessTier, &sa.PublicNetworkAccess, &sa.IsLive); err == nil {
			list = append(list, sa)
		}
	}
	c.JSON(http.StatusOK, list)
}

// GetAzureAKS serves GET /azure/aks
func GetAzureAKS(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT id, name, location, status, version, node_count, is_live FROM azure_aks_clusters")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []AKSCluster{}
	for rows.Next() {
		var aks AKSCluster
		if err := rows.Scan(&aks.ID, &aks.Name, &aks.Location, &aks.Status, &aks.Version, &aks.NodeCount, &aks.IsLive); err == nil {
			list = append(list, aks)
		}
	}
	c.JSON(http.StatusOK, list)
}

// GetAzureResources serves GET /azure/resources
func GetAzureResources(c *gin.Context) {
	list := []AzureResource{}

	// VMs
	rowsVM, err := postgres.DB.Query("SELECT id, name, location, status, is_live FROM azure_vms")
	if err == nil {
		defer rowsVM.Close()
		for rowsVM.Next() {
			var r AzureResource
			r.Type = "Virtual Machine"
			if err := rowsVM.Scan(&r.ID, &r.Name, &r.Location, &r.Status, &r.IsLive); err == nil {
				list = append(list, r)
			}
		}
	}

	// Storage
	rowsSA, err := postgres.DB.Query("SELECT id, name, location, status, is_live FROM azure_storage_accounts")
	if err == nil {
		defer rowsSA.Close()
		for rowsSA.Next() {
			var r AzureResource
			r.Type = "Storage Account"
			if err := rowsSA.Scan(&r.ID, &r.Name, &r.Location, &r.Status, &r.IsLive); err == nil {
				list = append(list, r)
			}
		}
	}

	// AKS
	rowsAKS, err := postgres.DB.Query("SELECT id, name, location, status, is_live FROM azure_aks_clusters")
	if err == nil {
		defer rowsAKS.Close()
		for rowsAKS.Next() {
			var r AzureResource
			r.Type = "AKS Cluster"
			if err := rowsAKS.Scan(&r.ID, &r.Name, &r.Location, &r.Status, &r.IsLive); err == nil {
				list = append(list, r)
			}
		}
	}

	c.JSON(http.StatusOK, list)
}

// GetAzureSecurity serves GET /azure/security
func GetAzureSecurity(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT id, severity, resource, recommendation, status FROM azure_security_findings")
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

// GetAzureCosts serves GET /azure/costs
func GetAzureCosts(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT date, resource_group, cost, currency FROM azure_costs ORDER BY date ASC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	list := []Cost{}
	for rows.Next() {
		var cost Cost
		if err := rows.Scan(&cost.Date, &cost.ResourceGroup, &cost.Cost, &cost.Currency); err == nil {
			list = append(list, cost)
		}
	}
	c.JSON(http.StatusOK, list)
}

// GetAzureRecommendations serves GET /azure/recommendations
func GetAzureRecommendations(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT id, resource, category, recommendation, impact FROM azure_recommendations")
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
