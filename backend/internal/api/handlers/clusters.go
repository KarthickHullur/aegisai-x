package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetClusters(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"data": []gin.H{
			{
				"id":         "cluster-prod-1",
				"name":       "AWS EKS Production East",
				"region":     "us-east-1",
				"provider":   "AWS",
				"nodes":      24,
				"cpu_cores":  96,
				"memory_gb":  384,
				"health":     "Healthy",
				"namespaces": []string{"default", "ingress", "production", "monitoring"},
			},
			{
				"id":         "cluster-staging-1",
				"name":       "Azure AKS Staging Central",
				"region":     "centralus",
				"provider":   "Azure",
				"nodes":      6,
				"cpu_cores":  24,
				"memory_gb":  96,
				"health":     "Warning",
				"namespaces": []string{"default", "staging", "testing"},
			},
		},
	})
}
