package handlers

import (
	"context"
	"net/http"
	"time"

	"aegisai-x/internal/kubernetes"

	"github.com/gin-gonic/gin"
)

// GetK8sStatus handles GET /k8s/status
func GetK8sStatus(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	status := kubernetes.GetK8sStatus(ctx)
	c.JSON(http.StatusOK, status)
}

// GetK8sNodes handles GET /k8s/nodes
func GetK8sNodes(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	list, err := kubernetes.GetK8sNodes(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// GetK8sNamespaces handles GET /k8s/namespaces
func GetK8sNamespaces(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	list, err := kubernetes.GetK8sNamespaces(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// GetK8sPods handles GET /k8s/pods
func GetK8sPods(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	list, err := kubernetes.GetK8sPods(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// GetK8sServices handles GET /k8s/services
func GetK8sServices(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	list, err := kubernetes.GetK8sServices(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// GetK8sDeployments handles GET /k8s/deployments
func GetK8sDeployments(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	list, err := kubernetes.GetK8sDeployments(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// ReconnectK8s handles POST /k8s/reconnect
func ReconnectK8s(c *gin.Context) {
	err := kubernetes.ReconnectK8s()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "status": "failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "reconnection completed"})
}
