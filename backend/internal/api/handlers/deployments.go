package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetDeployments(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"data": []gin.H{
			{
				"name":         "auth-service",
				"namespace":    "production",
				"version":      "v2.1.2",
				"replicas":     gin.H{"desired": 5, "current": 5, "ready": 5},
				"status":       "Healthy",
				"cpu_usage":    "240m",
				"memory_usage": "512Mi",
			},
			{
				"name":         "user-service",
				"namespace":    "production",
				"version":      "v1.8.0",
				"replicas":     gin.H{"desired": 3, "current": 3, "ready": 3},
				"status":       "Healthy",
				"cpu_usage":    "120m",
				"memory_usage": "256Mi",
			},
			{
				"name":         "web-frontend",
				"namespace":    "production",
				"version":      "v3.4.0",
				"replicas":     gin.H{"desired": 4, "current": 4, "ready": 4},
				"status":       "Healthy",
				"cpu_usage":    "80m",
				"memory_usage": "128Mi",
			},
			{
				"name":         "payments-gateway",
				"namespace":    "production",
				"version":      "v1.2.1",
				"replicas":     gin.H{"desired": 2, "current": 2, "ready": 1},
				"status":       "Degraded",
				"cpu_usage":    "310m",
				"memory_usage": "384Mi",
			},
		},
	})
}
