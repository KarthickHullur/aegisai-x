package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"aegisai-x/internal/aws"
	"aegisai-x/internal/azure"
	"aegisai-x/internal/database/postgres"
	"aegisai-x/internal/docker"
	"aegisai-x/internal/kubernetes"

	"github.com/gin-gonic/gin"
)

func getParentRG(id string) string {
	parts := strings.Split(id, "/")
	if len(parts) >= 5 {
		return strings.Join(parts[:5], "/")
	}
	return id
}

func GetTopology(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var nodes []gin.H

	var systemMode string
	_ = postgres.DB.QueryRow("SELECT value FROM platform_settings WHERE key = 'system_mode'").Scan(&systemMode)
	if systemMode == "" {
		systemMode = "DEMO"
	}

	k8sStatus := kubernetes.GetK8sStatus(ctx)
	dockerStatus := docker.GetDockerStatus(ctx)

	isK8sConnected := k8sStatus.Connected
	isDockerConnected := dockerStatus.Connected
	if systemMode == "DEMO" {
		isK8sConnected = false
		isDockerConnected = false
	}

	if isK8sConnected {
		// 1. Add Cluster Node
		clusterID := "cluster-" + k8sStatus.Cluster
		clusterNode := gin.H{
			"id":          clusterID,
			"label":       "Cluster: " + k8sStatus.Cluster,
			"type":        "cluster",
			"status":      "healthy",
			"x":           50,
			"y":           200,
			"connections": []string{},
		}

		namespaces, nsErr := kubernetes.GetK8sNamespaces(ctx)
		deployments, depErr := kubernetes.GetK8sDeployments(ctx)
		pods, podErr := kubernetes.GetK8sPods(ctx)
		services, svcErr := kubernetes.GetK8sServices(ctx)

		var nsConnections []string

		// 2. Add Namespace Nodes
		if nsErr == nil {
			for idx, ns := range namespaces {
				nsID := "ns-" + ns.Name
				nsConnections = append(nsConnections, nsID)

				var depConnections []string
				if depErr == nil {
					for _, d := range deployments {
						if d.Namespace == ns.Name {
							depConnections = append(depConnections, "dep-"+d.Name)
						}
					}
				}

				nodes = append(nodes, gin.H{
					"id":          nsID,
					"label":       "Namespace: " + ns.Name,
					"type":        "namespace",
					"status":      "healthy",
					"x":           200,
					"y":           100 + idx*150,
					"connections": depConnections,
				})
			}
		}
		clusterNode["connections"] = nsConnections
		nodes = append(nodes, clusterNode)

		// 3. Add Deployment Nodes
		if depErr == nil {
			for idx, d := range deployments {
				depID := "dep-" + d.Name
				status := "healthy"
				if d.ReadyReplicas == 0 {
					status = "critical"
				}

				var podConnections []string
				if podErr == nil {
					for _, p := range pods {
						if p.Namespace == d.Namespace && strings.HasPrefix(p.Name, d.Name) {
							podConnections = append(podConnections, "pod-"+p.Name)
						}
					}
				}

				nodes = append(nodes, gin.H{
					"id":          depID,
					"label":       "Deployment: " + d.Name,
					"type":        "deployment",
					"status":      status,
					"x":           350,
					"y":           80 + idx*120,
					"connections": podConnections,
				})
			}
		}

		// 4. Add Pod Nodes
		if podErr == nil {
			for idx, p := range pods {
				podID := "pod-" + p.Name
				status := "healthy"
				if p.Status == "Pending" {
					status = "warning"
				} else if p.Status == "Failed" || strings.Contains(p.Status, "BackOff") || p.Status == "Unknown" {
					status = "critical"
				}

				var podCPU, podMem float64
				dbErr := postgres.DB.QueryRowContext(ctx, "SELECT cpu_percent, memory_percent FROM kubernetes_pod_stats WHERE pod_name = $1 ORDER BY created_at DESC LIMIT 1", p.Name).Scan(&podCPU, &podMem)
				if dbErr == nil && status == "healthy" {
					if podCPU > 85.0 || podMem > 90.0 {
						status = "critical"
					} else if podCPU > 70.0 || podMem > 80.0 {
						status = "warning"
					}
				}

				nodes = append(nodes, gin.H{
					"id":          podID,
					"label":       "Pod: " + p.Name,
					"type":        "pod",
					"status":      status,
					"x":           500,
					"y":           60 + idx*100,
					"connections": []string{},
				})
			}
		}

		// 5. Add Service Nodes
		if svcErr == nil {
			for idx, s := range services {
				svcID := "svc-" + s.Name
				var podConnections []string
				if podErr == nil {
					for _, p := range pods {
						if p.Namespace == s.Namespace && (strings.HasPrefix(p.Name, s.Name) || (strings.Contains(s.Name, "postgres") && strings.Contains(p.Name, "postgres")) || (strings.Contains(s.Name, "redis") && strings.Contains(p.Name, "redis"))) {
							podConnections = append(podConnections, "pod-"+p.Name)
						}
					}
				}

				nodes = append(nodes, gin.H{
					"id":          svcID,
					"label":       "Service: " + s.Name,
					"type":        "service",
					"status":      "healthy",
					"x":           650,
					"y":           100 + idx*130,
					"connections": podConnections,
				})
			}
		}
	} else if isDockerConnected {
		containers, err := docker.GetDockerContainers(ctx)
		if err == nil && len(containers) > 0 {
			var gateways []string
			var services []string
			var backends []string
			var gatewayCount, serviceCount, backendCount int

			for _, cnt := range containers {
				nodeID := cnt.Name
				label := cnt.Name
				nodeType := "service"
				nameLower := strings.ToLower(cnt.Name)
				imageLower := strings.ToLower(cnt.Image)

				if strings.Contains(nameLower, "postgres") || strings.Contains(nameLower, "mysql") || strings.Contains(nameLower, "db") || strings.Contains(nameLower, "mariadb") || strings.Contains(nameLower, "mongo") ||
					strings.Contains(imageLower, "postgres") || strings.Contains(imageLower, "mysql") || strings.Contains(imageLower, "db") || strings.Contains(imageLower, "mariadb") || strings.Contains(imageLower, "mongo") {
					nodeType = "database"
				} else if strings.Contains(nameLower, "redis") || strings.Contains(nameLower, "cache") || strings.Contains(nameLower, "memcached") ||
					strings.Contains(imageLower, "redis") || strings.Contains(imageLower, "cache") || strings.Contains(imageLower, "memcached") {
					nodeType = "cache"
				} else if strings.Contains(nameLower, "gateway") || strings.Contains(nameLower, "ingress") || strings.Contains(nameLower, "nginx") || strings.Contains(nameLower, "proxy") || strings.Contains(nameLower, "frontend") ||
					strings.Contains(imageLower, "gateway") || strings.Contains(imageLower, "ingress") || strings.Contains(imageLower, "nginx") || strings.Contains(imageLower, "proxy") || strings.Contains(imageLower, "frontend") {
					nodeType = "gateway"
				}

				nodeStatus := "healthy"
				if cnt.State != "running" {
					nodeStatus = "critical"
				}

				var containerCPU, containerMem float64
				dbErr := postgres.DB.QueryRowContext(ctx, "SELECT cpu_percent, memory_percent FROM docker_container_stats WHERE container_name = $1 ORDER BY created_at DESC LIMIT 1", cnt.Name).Scan(&containerCPU, &containerMem)
				if dbErr == nil && nodeStatus == "healthy" {
					if containerCPU > 85.0 || containerMem > 90.0 {
						nodeStatus = "critical"
					} else if containerCPU > 70.0 || containerMem > 80.0 {
						nodeStatus = "warning"
					}
				}

				var x, y int
				switch nodeType {
				case "gateway":
					x = 100
					y = 100 + gatewayCount*120
					gatewayCount++
					gateways = append(gateways, nodeID)
				case "service":
					x = 260
					y = 80 + serviceCount*120
					serviceCount++
					services = append(services, nodeID)
				case "database", "cache":
					x = 420
					y = 80 + backendCount*120
					backendCount++
					backends = append(backends, nodeID)
				}

				nodes = append(nodes, gin.H{
					"id":          nodeID,
					"label":       label,
					"type":        nodeType,
					"status":      nodeStatus,
					"x":           x,
					"y":           y,
					"connections": []string{},
				})
			}

			for i, n := range nodes {
				nodeType := n["type"].(string)
				var connections []string
				if nodeType == "gateway" {
					connections = services
				} else if nodeType == "service" {
					connections = backends
				}
				nodes[i]["connections"] = connections
			}
		}
	} else {
		nodes = []gin.H{
			{
				"id":          "gateway",
				"label":       "Cloudflare Ingress",
				"type":        "gateway",
				"status":      "healthy",
				"x":           100,
				"y":           180,
				"connections": []string{"auth-service", "user-service"},
			},
			{
				"id":          "auth-service",
				"label":       "Auth-Service (v2.1)",
				"type":        "service",
				"status":      "critical",
				"x":           260,
				"y":           100,
				"connections": []string{"auth-db", "session-cache"},
			},
			{
				"id":          "user-service",
				"label":       "User-Service (v1.8)",
				"type":        "service",
				"status":      "healthy",
				"x":           260,
				"y":           260,
				"connections": []string{"user-db"},
			},
			{
				"id":          "auth-db",
				"label":       "Aurora PG Auth DB",
				"type":        "database",
				"status":      "healthy",
				"x":           420,
				"y":           50,
				"connections": []string{},
			},
			{
				"id":          "session-cache",
				"label":       "Redis Session",
				"type":        "cache",
				"status":      "warning",
				"x":           420,
				"y":           150,
				"connections": []string{},
			},
			{
				"id":          "user-db",
				"label":       "Aurora PG User DB",
				"type":        "database",
				"status":      "healthy",
				"x":           420,
				"y":           260,
				"connections": []string{},
			},
		}
	}

	// 6. Query Azure tables and append to nodes
	var hasAzure bool
	_ = postgres.DB.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM azure_subscriptions)").Scan(&hasAzure)

	if hasAzure {
		client := azure.GetClient()
		connected := false
		if client != nil {
			connected = client.Connected
		}

		isLiveFilter := "FALSE"
		if connected && systemMode == "LIVE" {
			isLiveFilter = "TRUE"
		}

		var vmCount, saCount, aksCount, rgCount int
		_ = postgres.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM azure_vms WHERE is_live = " + isLiveFilter).Scan(&vmCount)
		_ = postgres.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM azure_storage_accounts WHERE is_live = " + isLiveFilter).Scan(&saCount)
		_ = postgres.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM azure_aks_clusters WHERE is_live = " + isLiveFilter).Scan(&aksCount)
		_ = postgres.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM azure_resource_groups WHERE is_live = " + isLiveFilter).Scan(&rgCount)
		totalResources := vmCount + saCount + aksCount + rgCount

		var providerCount int
		_ = postgres.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM azure_providers WHERE is_live = " + isLiveFilter).Scan(&providerCount)

		azureRootStatus := "healthy"
		if connected {
			if totalResources == 0 {
				azureRootStatus = "warning"
			}
		} else {
			azureRootStatus = "critical"
		}

		azureRootID := "azure-root"
		azureRootNode := gin.H{
			"id":          azureRootID,
			"label":       "Microsoft Azure",
			"type":        "azure",
			"status":      azureRootStatus,
			"x":           850,
			"y":           200,
			"connections": []string{},
		}

		var azureNodes []gin.H

		// Fetch Subscriptions
		rowsSub, errSub := postgres.DB.QueryContext(ctx, "SELECT id, display_name, state FROM azure_subscriptions WHERE is_live = " + isLiveFilter)
		if errSub == nil {
			defer rowsSub.Close()
			var subConns []string
			for rowsSub.Next() {
				var id, displayName, state string
				if err := rowsSub.Scan(&id, &displayName, &state); err == nil {
					subConns = append(subConns, id)
					status := "healthy"
					if state != "Enabled" {
						status = "critical"
					}
					azureNodes = append(azureNodes, gin.H{
						"id":          id,
						"label":       displayName,
						"type":        "subscription",
						"status":      status,
						"x":           1000,
						"y":           200,
						"connections": []string{},
					})
				}
			}
			azureRootNode["connections"] = subConns
		}
		nodes = append(nodes, azureRootNode)

		// Fetch Resource Groups
		rowsRG, errRG := postgres.DB.QueryContext(ctx, "SELECT id, name, location, provisioning_state FROM azure_resource_groups WHERE is_live = " + isLiveFilter)
		if errRG == nil {
			defer rowsRG.Close()
			rgIndex := 0
			var rgMap = make(map[string][]string) // rg ID -> child resource IDs
			var rgList []gin.H

			// VMs
			rowsVM, errVM := postgres.DB.QueryContext(ctx, "SELECT id, name, status FROM azure_vms WHERE is_live = " + isLiveFilter)
			if errVM == nil {
				defer rowsVM.Close()
				for rowsVM.Next() {
					var id, name, status string
					if err := rowsVM.Scan(&id, &name, &status); err == nil {
						rgID := getParentRG(id)
						rgMap[rgID] = append(rgMap[rgID], id)

						vmStatus := "healthy"
						if status == "VM stopped" || status == "PowerState/stopped" {
							vmStatus = "warning"
						}
						azureNodes = append(azureNodes, gin.H{
							"id":          id,
							"label":       "VM: " + name,
							"type":        "vm",
							"status":      vmStatus,
							"x":           1350,
							"y":           60 + len(rgMap)*90,
							"connections": []string{},
						})
					}
				}
			}

			// Storage
			rowsSA, errSA := postgres.DB.QueryContext(ctx, "SELECT id, name, status FROM azure_storage_accounts WHERE is_live = " + isLiveFilter)
			if errSA == nil {
				defer rowsSA.Close()
				for rowsSA.Next() {
					var id, name, status string
					if err := rowsSA.Scan(&id, &name, &status); err == nil {
						rgID := getParentRG(id)
						rgMap[rgID] = append(rgMap[rgID], id)

						azureNodes = append(azureNodes, gin.H{
							"id":          id,
							"label":       "Storage: " + name,
							"type":        "storage",
							"status":      "healthy",
							"x":           1350,
							"y":           70 + len(rgMap)*90,
							"connections": []string{},
						})
					}
				}
			}

			// AKS
			rowsAKS, errAKS := postgres.DB.QueryContext(ctx, "SELECT id, name, status FROM azure_aks_clusters WHERE is_live = " + isLiveFilter)
			if errAKS == nil {
				defer rowsAKS.Close()
				for rowsAKS.Next() {
					var id, name, status string
					if err := rowsAKS.Scan(&id, &name, &status); err == nil {
						rgID := getParentRG(id)
						rgMap[rgID] = append(rgMap[rgID], id)

						aksStatus := "healthy"
						if status != "Succeeded" && status != "Running" {
							aksStatus = "critical"
						}
						azureNodes = append(azureNodes, gin.H{
							"id":          id,
							"label":       "AKS: " + name,
							"type":        "aks",
							"status":      aksStatus,
							"x":           1350,
							"y":           80 + len(rgMap)*90,
							"connections": []string{},
						})
					}
				}
			}

			for rowsRG.Next() {
				var id, name, location, provisioningState string
				if err := rowsRG.Scan(&id, &name, &location, &provisioningState); err == nil {
					conns := rgMap[id]
					if conns == nil {
						conns = []string{}
					}
					rgStatus := "healthy"
					if provisioningState != "Succeeded" {
						rgStatus = "warning"
					}
					rgList = append(rgList, gin.H{
						"id":          id,
						"label":       "RG: " + name,
						"type":        "resource-group",
						"status":      rgStatus,
						"x":           1150,
						"y":           100 + rgIndex*120,
						"connections": conns,
					})
					rgIndex++
				}
			}
			azureNodes = append(azureNodes, rgList...)

			// Add dynamic Providers node under Subscription
			providersNodeID := "azure-providers"
			providersNode := gin.H{
				"id":          providersNodeID,
				"label":       fmt.Sprintf("Providers: %d", providerCount),
				"type":        "provider",
				"status":      "healthy",
				"x":           1150,
				"y":           100 + rgIndex*120,
				"connections": []string{},
			}
			azureNodes = append(azureNodes, providersNode)

			// Set subscription connections to resource groups and the providers node
			for i, an := range azureNodes {
				if an["type"].(string) == "subscription" {
					var subConns []string
					for _, rg := range rgList {
						subConns = append(subConns, rg["id"].(string))
					}
					subConns = append(subConns, providersNodeID)
					azureNodes[i]["connections"] = subConns
					break
				}
			}
		}

		nodes = append(nodes, azureNodes...)
	}

	// 7. Query AWS tables and append to nodes
	var hasAWS bool
	_ = postgres.DB.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM aws_accounts)").Scan(&hasAWS)

	if hasAWS {
		client := aws.GetClient()
		connected := false
		if client != nil {
			connected = client.Connected
		}

		isLiveFilter := "FALSE"
		if connected && systemMode == "LIVE" {
			isLiveFilter = "TRUE"
		}

		var accountID string
		_ = postgres.DB.QueryRowContext(ctx, "SELECT id FROM aws_accounts WHERE is_live = " + isLiveFilter + " LIMIT 1").Scan(&accountID)
		if accountID == "" {
			if connected && client != nil {
				accountID = client.AccountID
			} else {
				accountID = "123456789012"
			}
		}

		var regionsCount int
		_ = postgres.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM aws_regions WHERE is_live = " + isLiveFilter).Scan(&regionsCount)

		var ec2Count int
		_ = postgres.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM aws_ec2_instances WHERE is_live = " + isLiveFilter).Scan(&ec2Count)

		var s3Count int
		_ = postgres.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM aws_s3_buckets WHERE is_live = " + isLiveFilter).Scan(&s3Count)

		var vpcCount int
		_ = postgres.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM aws_vpcs WHERE is_live = " + isLiveFilter).Scan(&vpcCount)

		var iamUsersCount int
		_ = postgres.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM aws_iam_users WHERE is_live = " + isLiveFilter).Scan(&iamUsersCount)

		var iamRolesCount int
		_ = postgres.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM aws_iam_roles WHERE is_live = " + isLiveFilter).Scan(&iamRolesCount)

		var iamPoliciesCount int
		_ = postgres.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM aws_iam_policies WHERE is_live = " + isLiveFilter).Scan(&iamPoliciesCount)

		var findingsCount int
		_ = postgres.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM aws_security_findings").Scan(&findingsCount)

		awsRootStatus := "healthy"
		if connected {
			if ec2Count == 0 && s3Count == 0 && vpcCount == 0 {
				awsRootStatus = "warning"
			}
		} else {
			awsRootStatus = "critical"
		}

		awsRootID := "aws-root"
		awsRootNode := gin.H{
			"id":          awsRootID,
			"label":       "Amazon Web Services",
			"type":        "aws",
			"status":      awsRootStatus,
			"x":           1550,
			"y":           200,
			"connections": []string{"aws-account"},
		}
		nodes = append(nodes, awsRootNode)

		accountNode := gin.H{
			"id":          "aws-account",
			"label":       "Account: " + accountID,
			"type":        "aws-account",
			"status":      "healthy",
			"x":           1700,
			"y":           200,
			"connections": []string{"aws-regions", "aws-ec2", "aws-s3", "aws-vpc", "aws-iam-users", "aws-iam-roles", "aws-iam-policies", "aws-findings"},
		}
		nodes = append(nodes, accountNode)

		nodes = append(nodes, gin.H{
			"id":          "aws-regions",
			"label":       fmt.Sprintf("Regions: %d", regionsCount),
			"type":        "aws-regions",
			"status":      "healthy",
			"x":           1850,
			"y":           50,
			"connections": []string{},
		})

		// Fetch specific EC2 instances
		var ec2Conns []string
		rowsEC2, errEC2 := postgres.DB.QueryContext(ctx, "SELECT id, name, state FROM aws_ec2_instances WHERE is_live = " + isLiveFilter)
		if errEC2 == nil {
			defer rowsEC2.Close()
			idx := 0
			for rowsEC2.Next() {
				var id, name, state string
				if err := rowsEC2.Scan(&id, &name, &state); err == nil {
					ec2Conns = append(ec2Conns, "aws-ec2-"+id)
					ec2Status := "healthy"
					if state == "stopped" {
						ec2Status = "warning"
					}
					nodes = append(nodes, gin.H{
						"id":          "aws-ec2-" + id,
						"label":       "EC2: " + name,
						"type":        "vm",
						"status":      ec2Status,
						"x":           2050,
						"y":           80 + idx*90,
						"connections": []string{},
					})
					idx++
				}
			}
		}
		nodes = append(nodes, gin.H{
			"id":          "aws-ec2",
			"label":       fmt.Sprintf("EC2: %d", ec2Count),
			"type":        "aws-ec2",
			"status":      "healthy",
			"x":           1850,
			"y":           120,
			"connections": ec2Conns,
		})

		// Fetch specific S3 buckets
		var s3Conns []string
		rowsS3, errS3 := postgres.DB.QueryContext(ctx, "SELECT name, public_access FROM aws_s3_buckets WHERE is_live = " + isLiveFilter)
		if errS3 == nil {
			defer rowsS3.Close()
			idx := 0
			for rowsS3.Next() {
				var name, publicAccess string
				if err := rowsS3.Scan(&name, &publicAccess); err == nil {
					s3Conns = append(s3Conns, "aws-s3-"+name)
					s3Status := "healthy"
					if publicAccess == "Public" {
						s3Status = "critical"
					}
					nodes = append(nodes, gin.H{
						"id":          "aws-s3-" + name,
						"label":       "S3: " + name,
						"type":        "storage",
						"status":      s3Status,
						"x":           2050,
						"y":           160 + idx*90,
						"connections": []string{},
					})
					idx++
				}
			}
		}
		nodes = append(nodes, gin.H{
			"id":          "aws-s3",
			"label":       fmt.Sprintf("S3: %d", s3Count),
			"type":        "aws-s3",
			"status":      "healthy",
			"x":           1850,
			"y":           200,
			"connections": s3Conns,
		})

		// Fetch specific VPCs
		var vpcConns []string
		rowsVPC, errVPC := postgres.DB.QueryContext(ctx, "SELECT id, name FROM aws_vpcs WHERE is_live = " + isLiveFilter)
		if errVPC == nil {
			defer rowsVPC.Close()
			idx := 0
			for rowsVPC.Next() {
				var id, name string
				if err := rowsVPC.Scan(&id, &name); err == nil {
					vpcConns = append(vpcConns, "aws-vpc-"+id)
					nodes = append(nodes, gin.H{
						"id":          "aws-vpc-" + id,
						"label":       "VPC: " + name,
						"type":        "resource-group",
						"status":      "healthy",
						"x":           2050,
						"y":           240 + idx*90,
						"connections": []string{},
					})
					idx++
				}
			}
		}
		nodes = append(nodes, gin.H{
			"id":          "aws-vpc",
			"label":       fmt.Sprintf("VPC: %d", vpcCount),
			"type":        "aws-vpc",
			"status":      "healthy",
			"x":           1850,
			"y":           280,
			"connections": vpcConns,
		})

		nodes = append(nodes, gin.H{
			"id":          "aws-iam-users",
			"label":       fmt.Sprintf("Users: %d", iamUsersCount),
			"type":        "aws-iam",
			"status":      "healthy",
			"x":           1850,
			"y":           360,
			"connections": []string{},
		})

		nodes = append(nodes, gin.H{
			"id":          "aws-iam-roles",
			"label":       fmt.Sprintf("Roles: %d", iamRolesCount),
			"type":        "aws-iam",
			"status":      "healthy",
			"x":           1850,
			"y":           440,
			"connections": []string{},
		})

		nodes = append(nodes, gin.H{
			"id":          "aws-iam-policies",
			"label":       fmt.Sprintf("Policies: %d", iamPoliciesCount),
			"type":        "aws-iam",
			"status":      "healthy",
			"x":           1850,
			"y":           520,
			"connections": []string{},
		})

		findingsStatus := "healthy"
		if findingsCount > 0 {
			findingsStatus = "warning"
		}
		nodes = append(nodes, gin.H{
			"id":          "aws-findings",
			"label":       fmt.Sprintf("Findings: %d", findingsCount),
			"type":        "aws-findings",
			"status":      findingsStatus,
			"x":           1850,
			"y":           600,
			"connections": []string{},
		})
	}

	c.JSON(http.StatusOK, gin.H{"nodes": nodes})
}
