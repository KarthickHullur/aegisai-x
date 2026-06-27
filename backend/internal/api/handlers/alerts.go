package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetAlerts(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"data": []gin.H{
			{
				"id":        "alert-101",
				"severity":  "Critical",
				"title":     "K8s Cluster node memory exhaustion",
				"source":    "kube-us-east-cluster",
				"status":    "Open",
				"timestamp": "2026-06-23T18:05:00Z",
			},
			{
				"id":        "alert-102",
				"severity":  "High",
				"title":     "DB Write Latency anomaly spike",
				"source":    "rds-aurora-postgres",
				"status":    "Investigating",
				"timestamp": "2026-06-23T17:48:00Z",
			},
			{
				"id":        "alert-103",
				"severity":  "Medium",
				"title":     "API response code 502 Bad Gateway",
				"source":    "ingress-nginx-controller",
				"status":    "Acknowledged",
				"timestamp": "2026-06-23T17:12:00Z",
			},
			{
				"id":        "alert-104",
				"severity":  "Low",
				"title":     "SSL/TLS Certificate expiring in 15 days",
				"source":    "cert-manager-production",
				"status":    "Resolved",
				"timestamp": "2026-06-23T14:15:00Z",
			},
		},
	})
}
