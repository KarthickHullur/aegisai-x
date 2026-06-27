package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"aegisai-x/internal/docker"
	"aegisai-x/internal/kubernetes"

	"github.com/gin-gonic/gin"
)

func GetRecommendations(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var data []gin.H

	status := docker.GetDockerStatus(ctx)
	if status.Connected {
		containers, err := docker.GetDockerContainers(ctx)
		if err == nil {
			for _, cnt := range containers {
				if cnt.State != "running" {
					data = append(data, gin.H{
						"id":          "rec-docker-restart-" + cnt.ID,
						"agent":       "Reliability Agent",
						"target":      cnt.Name,
						"type":        "Container Recovery",
						"description": fmt.Sprintf("Run: 'docker restart %s' to restore stopped container service.", cnt.Name),
						"difficulty":  "Low",
						"impact":      "High",
						"status":      "Pending",
					})
				}
			}
		}
	}

	// Fetch Kubernetes Recommendations
	k8sRecs, err := kubernetes.GetRecommendations(ctx)
	if err == nil {
		for _, r := range k8sRecs {
			data = append(data, gin.H{
				"id":          r.ID,
				"agent":       r.Agent,
				"target":      r.Target,
				"type":        r.Type,
				"description": r.Description,
				"difficulty":  r.Difficulty,
				"impact":      r.Impact,
				"status":      r.Status,
			})
		}
	}

	data = append(data, []gin.H{
		{
			"id":          "rec-001",
			"agent":       "Reliability Agent",
			"target":      "auth-service-k8s-pod",
			"type":        "Scale Up Limits",
			"description": "Increase memory limits on auth-service deployment yaml from 1Gi to 2Gi to resolve OOM crashes.",
			"difficulty":  "Low",
			"impact":      "High",
			"status":      "Pending",
		},
		{
			"id":          "rec-002",
			"agent":       "Security Agent",
			"target":      "deprecated-iam-token",
			"type":        "Access Rotation",
			"description": "Revoke compromise token for IAM profile: 'ingress-sa' and rotate credentials.",
			"difficulty":  "Medium",
			"impact":      "Critical",
			"status":      "Approved",
		},
		{
			"id":          "rec-003",
			"agent":       "Cost Agent",
			"target":      "staging-db-postgres",
			"type":        "Instance Downscale",
			"description": "Downscale database instance classes from db.t3.medium to db.t3.micro (idle CPU usage <3%).",
			"difficulty":  "Low",
			"impact":      "Medium",
			"status":      "Pending",
		},
	}...)

	c.JSON(http.StatusOK, gin.H{
		"data": data,
	})
}

