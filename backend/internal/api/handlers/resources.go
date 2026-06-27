package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"aegisai-x/internal/database/postgres"
	"aegisai-x/internal/docker"
	"aegisai-x/internal/kubernetes"

	"github.com/gin-gonic/gin"
)

func GetResources(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	dockerStatus := docker.GetDockerStatus(ctx)
	k8sStatus := kubernetes.GetK8sStatus(ctx)

	if dockerStatus.Connected || k8sStatus.Connected {
		var list []gin.H
		idCounter := 10000

		// Add Docker resources
		if dockerStatus.Connected {
			list = append(list, gin.H{
				"id":     idCounter,
				"name":   "Docker Engine",
				"cloud":  "Local",
				"type":   "Docker Host v" + dockerStatus.EngineVersion,
				"status": "Healthy",
			})
			idCounter++

			containers, err := docker.GetDockerContainers(ctx)
			if err == nil {
				for _, cnt := range containers {
					statusStr := "Running"
					if cnt.State != "running" {
						statusStr = "Stopped"
					}
					list = append(list, gin.H{
						"id":     idCounter,
						"name":   cnt.Name,
						"cloud":  "Docker",
						"type":   "Container (" + cnt.Image + ")",
						"status": statusStr,
					})
					idCounter++
				}
			}
		}

		// Add Kubernetes resources
		if k8sStatus.Connected {
			list = append(list, gin.H{
				"id":     idCounter,
				"name":   "Kubernetes Cluster: " + k8sStatus.Cluster,
				"cloud":  "Local",
				"type":   "Kubernetes control-plane v" + k8sStatus.Version,
				"status": "Healthy",
			})
			idCounter++

			// 1. Namespaces
			namespaces, err := kubernetes.GetK8sNamespaces(ctx)
			if err == nil {
				for _, ns := range namespaces {
					list = append(list, gin.H{
						"id":     idCounter,
						"name":   "Namespace: " + ns.Name,
						"cloud":  "Kubernetes",
						"type":   "K8s Namespace",
						"status": ns.Status,
					})
					idCounter++
				}
			}

			// 2. Deployments
			deployments, err := kubernetes.GetK8sDeployments(ctx)
			if err == nil {
				for _, d := range deployments {
					statusStr := "Running"
					if d.ReadyReplicas == 0 {
						statusStr = "Warning"
					}
					list = append(list, gin.H{
						"id":     idCounter,
						"name":   "Deployment: " + d.Name,
						"cloud":  "Kubernetes",
						"type":   fmt.Sprintf("K8s Deployment (Replicas: %d/%d)", d.ReadyReplicas, d.DesiredReplicas),
						"status": statusStr,
					})
					idCounter++
				}
			}

			// 3. Pods
			pods, err := kubernetes.GetK8sPods(ctx)
			if err == nil {
				for _, p := range pods {
					list = append(list, gin.H{
						"id":     idCounter,
						"name":   "Pod: " + p.Name,
						"cloud":  "Kubernetes",
						"type":   fmt.Sprintf("K8s Pod (%s) Namespace: %s", p.Node, p.Namespace),
						"status": p.Status,
					})
					idCounter++
				}
			}

			// 4. Services
			services, err := kubernetes.GetK8sServices(ctx)
			if err == nil {
				for _, s := range services {
					list = append(list, gin.H{
						"id":     idCounter,
						"name":   "Service: " + s.Name,
						"cloud":  "Kubernetes",
						"type":   fmt.Sprintf("K8s Service (IP: %s) Namespace: %s", s.ClusterIP, s.Namespace),
						"status": "Healthy",
					})
					idCounter++
				}
			}
		}

		// Add Azure resources from postgres cache
		rowsVM, errVM := postgres.DB.QueryContext(ctx, "SELECT name, status, location FROM azure_vms")
		if errVM == nil {
			defer rowsVM.Close()
			for rowsVM.Next() {
				var name, status, location string
				if err := rowsVM.Scan(&name, &status, &location); err == nil {
					statusStr := "Running"
					if status == "VM stopped" || status == "PowerState/stopped" {
						statusStr = "Stopped"
					}
					list = append(list, gin.H{
						"id":     idCounter,
						"name":   name,
						"cloud":  "Azure",
						"type":   "Virtual Machine (" + location + ")",
						"status": statusStr,
					})
					idCounter++
				}
			}
		}

		rowsSA, errSA := postgres.DB.QueryContext(ctx, "SELECT name, status, location FROM azure_storage_accounts")
		if errSA == nil {
			defer rowsSA.Close()
			for rowsSA.Next() {
				var name, status, location string
				if err := rowsSA.Scan(&name, &status, &location); err == nil {
					list = append(list, gin.H{
						"id":     idCounter,
						"name":   name,
						"cloud":  "Azure",
						"type":   "Storage Account (" + location + ")",
						"status": status,
					})
					idCounter++
				}
			}
		}

		rowsAKS, errAKS := postgres.DB.QueryContext(ctx, "SELECT name, status, location FROM azure_aks_clusters")
		if errAKS == nil {
			defer rowsAKS.Close()
			for rowsAKS.Next() {
				var name, status, location string
				if err := rowsAKS.Scan(&name, &status, &location); err == nil {
					list = append(list, gin.H{
						"id":     idCounter,
						"name":   name,
						"cloud":  "Azure",
						"type":   "AKS Cluster (" + location + ")",
						"status": status,
					})
					idCounter++
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{"data": list})
		return
	}

	rows, err := postgres.DB.Query("SELECT id, name, cloud, type, status FROM resources ORDER BY id ASC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch cloud resources: " + err.Error()})
		return
	}
	defer rows.Close()

	list := []gin.H{}
	for rows.Next() {
		var id int
		var name, cloud, rType, status string

		if err := rows.Scan(&id, &name, &cloud, &rType, &status); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan cloud resource: " + err.Error()})
			return
		}

		list = append(list, gin.H{
			"id":     id,
			"name":   name,
			"cloud":  cloud,
			"type":   rType,
			"status": status,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}
