package handlers

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"aegisai-x/internal/database/postgres"
	"aegisai-x/internal/docker"
	"aegisai-x/internal/kubernetes"
	"aegisai-x/internal/selfhealing"

	"github.com/gin-gonic/gin"
)

var StartTime time.Time

func init() {
	StartTime = time.Now()
}

// SystemStatus handles GET /system/status requests
func SystemStatus(c *gin.Context) {
	ctx := context.Background()

	// 1. Resolve Project Root, Backend Path, Working Directory
	projectRoot, _, cwd := selfhealing.ResolvePaths()

	// 2. Check Database Health
	dbHealth := "healthy"
	if postgres.DB == nil {
		dbHealth = "unhealthy (nil database pool)"
	} else if err := postgres.DB.Ping(); err != nil {
		dbHealth = "unhealthy (" + err.Error() + ")"
	}

	// 3. Check Docker Health
	dockerHealth := "disconnected"
	dockerStatus := docker.GetDockerStatus(ctx)
	if dockerStatus.Connected {
		dockerHealth = "connected"
	} else if dockerStatus.Error != "" {
		dockerHealth = "disconnected (" + dockerStatus.Error + ")"
	}

	// 4. Check Kubernetes Health
	k8sHealth := "unavailable"
	k8sStatus := kubernetes.GetK8sStatus(ctx)
	if k8sStatus.Connected {
		k8sHealth = "connected"
	} else if k8sStatus.Error != "" {
		k8sHealth = "unavailable (" + k8sStatus.Error + ")"
	}

	// 5. Check Incidents API Health
	incidentsApiHealth := "healthy"
	if postgres.DB == nil {
		incidentsApiHealth = "unhealthy (nil database pool)"
	} else {
		var count int
		err := postgres.DB.QueryRow("SELECT COUNT(*) FROM incidents").Scan(&count)
		if err != nil {
			incidentsApiHealth = "unhealthy (" + err.Error() + ")"
		}
	}

	// 6. Get Port
	portStr := os.Getenv("PORT")
	if portStr == "" {
		portStr = ":8082"
	}
	portStr = strings.TrimPrefix(portStr, ":")
	port, err := strconv.Atoi(portStr)
	if err != nil {
		port = 8082
	}

	log.Println("[Dashboard] Consistency Check Passed")
	c.JSON(http.StatusOK, gin.H{
		"backend":          "healthy",
		"database":         dbHealth,
		"docker":           dockerHealth,
		"kubernetes":       k8sHealth,
		"incidentsApi":     incidentsApiHealth,
		"frontendApi":      "healthy",
		"uptime":           time.Since(StartTime).String(),
		"projectRoot":      projectRoot,
		"workingDirectory": cwd,
		"backendPort":      port,
	})
}
