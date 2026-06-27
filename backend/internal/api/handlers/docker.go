package handlers

import (
	"context"
	"net/http"
	"time"

	"aegisai-x/internal/docker"

	"github.com/gin-gonic/gin"
)

// GetDockerStatus handles GET /docker/status
func GetDockerStatus(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	status := docker.GetDockerStatus(ctx)
	c.JSON(http.StatusOK, status)
}

// GetDockerContainers handles GET /docker/containers
func GetDockerContainers(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	list, err := docker.GetDockerContainers(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, list)
}

// GetDockerStats handles GET /docker/stats
func GetDockerStats(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	stats, err := docker.GetDockerStats(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}
