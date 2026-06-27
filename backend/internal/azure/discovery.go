package azure

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"os/exec"
)

// PollResources discovers Azure resources and updates DB
func PollResources(ctx context.Context, db *sql.DB) error {
	client := GetClient()
	if client == nil || !client.Connected {
		// Degraded mode: do not clear the database so the seeded mock data remains visible.
		return nil
	}

	log.Println("[Azure] Discovering resources...")

	// 1. Discover Subscriptions
	subs, err := discoverSubscriptions(ctx)
	if err == nil {
		_, _ = db.Exec("DELETE FROM azure_subscriptions WHERE is_live = TRUE")
		for _, s := range subs {
			_, _ = db.Exec("INSERT INTO azure_subscriptions (id, subscription_id, display_name, state, is_live) VALUES ($1, $2, $3, $4, TRUE) "+
				"ON CONFLICT (id) DO UPDATE SET subscription_id = EXCLUDED.subscription_id, display_name = EXCLUDED.display_name, state = EXCLUDED.state, is_live = EXCLUDED.is_live",
				s.ID, s.SubID, s.DisplayName, s.State)
		}
	}

	// 2. Discover Resource Groups
	rgs, err := discoverResourceGroups(ctx)
	if err == nil {
		_, _ = db.Exec("DELETE FROM azure_resource_groups WHERE is_live = TRUE")
		for _, rg := range rgs {
			tagsBytes, _ := json.Marshal(rg.Tags)
			_, _ = db.Exec("INSERT INTO azure_resource_groups (id, name, location, provisioning_state, tags, is_live) VALUES ($1, $2, $3, $4, $5, TRUE) "+
				"ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, location = EXCLUDED.location, provisioning_state = EXCLUDED.provisioning_state, tags = EXCLUDED.tags, is_live = EXCLUDED.is_live",
				rg.ID, rg.Name, rg.Location, rg.ProvisioningState, string(tagsBytes))
		}
	}

	// 3. Discover VMs
	vms, err := discoverVMs(ctx)
	if err == nil {
		_, _ = db.Exec("DELETE FROM azure_vms WHERE is_live = TRUE")
		for _, vm := range vms {
			_, _ = db.Exec("INSERT INTO azure_vms (id, name, location, status, size, os_type, is_live) VALUES ($1, $2, $3, $4, $5, $6, TRUE) "+
				"ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, location = EXCLUDED.location, status = EXCLUDED.status, size = EXCLUDED.size, os_type = EXCLUDED.os_type, is_live = EXCLUDED.is_live",
				vm.ID, vm.Name, vm.Location, vm.Status, vm.Size, vm.OsType)
		}
	}

	// 4. Discover Storage Accounts
	sas, err := discoverStorageAccounts(ctx)
	if err == nil {
		_, _ = db.Exec("DELETE FROM azure_storage_accounts WHERE is_live = TRUE")
		for _, sa := range sas {
			_, _ = db.Exec("INSERT INTO azure_storage_accounts (id, name, location, status, sku, access_tier, public_network_access, is_live) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE) "+
				"ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, location = EXCLUDED.location, status = EXCLUDED.status, sku = EXCLUDED.sku, access_tier = EXCLUDED.access_tier, public_network_access = EXCLUDED.public_network_access, is_live = EXCLUDED.is_live",
				sa.ID, sa.Name, sa.Location, sa.Status, sa.Sku, sa.AccessTier, sa.PublicNetworkAccess)
		}
	}

	// 5. Discover AKS Clusters
	aks, err := discoverAKS(ctx)
	if err == nil {
		_, _ = db.Exec("DELETE FROM azure_aks_clusters WHERE is_live = TRUE")
		for _, cluster := range aks {
			_, _ = db.Exec("INSERT INTO azure_aks_clusters (id, name, location, status, version, node_count, is_live) VALUES ($1, $2, $3, $4, $5, $6, TRUE) "+
				"ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, location = EXCLUDED.location, status = EXCLUDED.status, version = EXCLUDED.version, node_count = EXCLUDED.node_count, is_live = EXCLUDED.is_live",
				cluster.ID, cluster.Name, cluster.Location, cluster.Status, cluster.Version, cluster.NodeCount)
		}
	}

	// 6. Discover Providers
	provs, err := discoverProviders(ctx)
	if err == nil {
		_, _ = db.Exec("DELETE FROM azure_providers WHERE is_live = TRUE")
		for _, p := range provs {
			_, _ = db.Exec("INSERT INTO azure_providers (namespace, registration_state, is_live) VALUES ($1, $2, TRUE) "+
				"ON CONFLICT (namespace, is_live) DO UPDATE SET registration_state = EXCLUDED.registration_state",
				p.Namespace, p.RegistrationState)
		}
	}

	return nil
}

func discoverSubscriptions(ctx context.Context) ([]Subscription, error) {
	azPath := GetAZPath()
	cmd := exec.CommandContext(ctx, azPath, "account", "list", "-o", "json")
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var raw []struct {
		ID    string `json:"id"`
		Name  string `json:"name"`
		State string `json:"state"`
	}
	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, err
	}
	var subs []Subscription
	for _, r := range raw {
		subs = append(subs, Subscription{
			ID:          "/subscriptions/" + r.ID,
			SubID:       r.ID,
			DisplayName: r.Name,
			State:       r.State,
		})
	}
	return subs, nil
}

func discoverResourceGroups(ctx context.Context) ([]ResourceGroup, error) {
	azPath := GetAZPath()
	cmd := exec.CommandContext(ctx, azPath, "group", "list", "-o", "json")
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var raw []struct {
		ID         string            `json:"id"`
		Name       string            `json:"name"`
		Location   string            `json:"location"`
		Properties struct {
			ProvisioningState string `json:"provisioningState"`
		} `json:"properties"`
		Tags       map[string]string `json:"tags"`
	}
	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, err
	}
	var rgs []ResourceGroup
	for _, r := range raw {
		rgs = append(rgs, ResourceGroup{
			ID:                r.ID,
			Name:              r.Name,
			Location:          r.Location,
			ProvisioningState: r.Properties.ProvisioningState,
			Tags:              r.Tags,
		})
	}
	return rgs, nil
}

func discoverProviders(ctx context.Context) ([]Provider, error) {
	azPath := GetAZPath()
	cmd := exec.CommandContext(ctx, azPath, "provider", "list", "--query", "[?registrationState=='Registered'].{namespace:namespace, registrationState:registrationState}", "-o", "json")
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var providers []Provider
	if err := json.Unmarshal(out, &providers); err != nil {
		return nil, err
	}
	return providers, nil
}

func discoverVMs(ctx context.Context) ([]VirtualMachine, error) {
	azPath := GetAZPath()
	cmd := exec.CommandContext(ctx, azPath, "vm", "list", "-d", "-o", "json")
	out, err := cmd.Output()
	if err != nil {
		cmd = exec.CommandContext(ctx, azPath, "vm", "list", "-o", "json")
		out, err = cmd.Output()
		if err != nil {
			return nil, err
		}
	}

	var raw []struct {
		ID              string `json:"id"`
		Name            string `json:"name"`
		Location        string `json:"location"`
		PowerState      string `json:"powerState"`
		HardwareProfile struct {
			VMSize string `json:"vmSize"`
		} `json:"hardwareProfile"`
		StorageProfile struct {
			OsDisk struct {
				OsType string `json:"osType"`
			} `json:"osDisk"`
		} `json:"storageProfile"`
	}

	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, err
	}

	var vms []VirtualMachine
	for _, r := range raw {
		status := r.PowerState
		if status == "" {
			status = "VM running"
		}
		vms = append(vms, VirtualMachine{
			ID:       r.ID,
			Name:     r.Name,
			Location: r.Location,
			Status:   status,
			Size:     r.HardwareProfile.VMSize,
			OsType:   r.StorageProfile.OsDisk.OsType,
		})
	}
	return vms, nil
}

func discoverStorageAccounts(ctx context.Context) ([]StorageAccount, error) {
	azPath := GetAZPath()
	cmd := exec.CommandContext(ctx, azPath, "storage", "account", "list", "-o", "json")
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var raw []struct {
		ID                  string `json:"id"`
		Name                string `json:"name"`
		Location            string `json:"location"`
		StatusOfPrimary     string `json:"statusOfPrimary"`
		Sku                 struct {
			Name string `json:"name"`
		} `json:"sku"`
		AccessTier          string `json:"accessTier"`
		PublicNetworkAccess string `json:"publicNetworkAccess"`
	}
	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, err
	}

	var sas []StorageAccount
	for _, r := range raw {
		sas = append(sas, StorageAccount{
			ID:                  r.ID,
			Name:                r.Name,
			Location:            r.Location,
			Status:              r.StatusOfPrimary,
			Sku:                 r.Sku.Name,
			AccessTier:          r.AccessTier,
			PublicNetworkAccess: r.PublicNetworkAccess,
		})
	}
	return sas, nil
}

func discoverAKS(ctx context.Context) ([]AKSCluster, error) {
	azPath := GetAZPath()
	cmd := exec.CommandContext(ctx, azPath, "aks", "list", "-o", "json")
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	var raw []struct {
		ID                string `json:"id"`
		Name              string `json:"name"`
		Location          string `json:"location"`
		ProvisioningState string `json:"provisioningState"`
		KubernetesVersion string `json:"kubernetesVersion"`
		AgentPoolProfiles []struct {
			Count int `json:"count"`
		} `json:"agentPoolProfiles"`
	}
	if err := json.Unmarshal(out, &raw); err != nil {
		return nil, err
	}

	var clusters []AKSCluster
	for _, r := range raw {
		nodeCount := 0
		if len(r.AgentPoolProfiles) > 0 {
			nodeCount = r.AgentPoolProfiles[0].Count
		}
		clusters = append(clusters, AKSCluster{
			ID:        r.ID,
			Name:      r.Name,
			Location:  r.Location,
			Status:    r.ProvisioningState,
			Version:   r.KubernetesVersion,
			NodeCount: nodeCount,
		})
	}
	return clusters, nil
}
