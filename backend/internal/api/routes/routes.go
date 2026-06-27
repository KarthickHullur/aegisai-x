package routes

import (
	"log"

	"aegisai-x/internal/api/handlers"
	"aegisai-x/internal/aws"
	"aegisai-x/internal/azure"
	"aegisai-x/internal/security"

	"github.com/gin-gonic/gin"
)

func SetupRoutes() *gin.Engine {
	r := gin.Default()

	// CORS Middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	r.GET("/health", handlers.Health)
	r.GET("/system/status", handlers.SystemStatus)
	r.GET("/docker/status", handlers.GetDockerStatus)
	r.GET("/docker/containers", handlers.GetDockerContainers)
	r.GET("/docker/stats", handlers.GetDockerStats)
	r.GET("/k8s/status", handlers.GetK8sStatus)
	r.GET("/k8s/nodes", handlers.GetK8sNodes)
	r.GET("/k8s/namespaces", handlers.GetK8sNamespaces)
	r.GET("/k8s/pods", handlers.GetK8sPods)
	r.GET("/k8s/services", handlers.GetK8sServices)
	r.GET("/k8s/deployments", handlers.GetK8sDeployments)
	r.POST("/k8s/reconnect", handlers.ReconnectK8s)
	r.GET("/prometheus/status", handlers.GetPrometheusStatus)
	r.GET("/prometheus/query", handlers.QueryPrometheus)
	r.GET("/prometheus/query_range", handlers.QueryRangePrometheus)
	r.GET("/prometheus/alerts", handlers.GetPrometheusAlerts)
	r.GET("/prometheus/metrics", handlers.GetPrometheusMetricsList)
	r.GET("/incidents", handlers.GetIncidents)
	r.GET("/agents", handlers.GetAgents)
	r.GET("/resources", handlers.GetResources)

	// Azure Integration Endpoints
	azureGroup := r.Group("/azure")
	{
		azureGroup.GET("/status", azure.GetAzureStatus)
		azureGroup.GET("/subscriptions", azure.GetAzureSubscriptions)
		azureGroup.GET("/resource-groups", azure.GetAzureResourceGroups)
		azureGroup.GET("/providers", azure.GetAzureProviders)
		azureGroup.GET("/vms", azure.GetAzureVMs)
		azureGroup.GET("/storage", azure.GetAzureStorage)
		azureGroup.GET("/aks", azure.GetAzureAKS)
		azureGroup.GET("/resources", azure.GetAzureResources)
		azureGroup.GET("/security", azure.GetAzureSecurity)
		azureGroup.GET("/costs", azure.GetAzureCosts)
		azureGroup.GET("/recommendations", azure.GetAzureRecommendations)
	}

	// AWS Integration Endpoints
	awsGroup := r.Group("/aws")
	{
		awsGroup.GET("/status", aws.GetAWSStatus)
		awsGroup.GET("/account", aws.GetAWSAccount)
		awsGroup.GET("/regions", aws.GetAWSRegions)
		awsGroup.GET("/ec2", aws.GetAWSEC2)
		awsGroup.GET("/s3", aws.GetAWSS3)
		awsGroup.GET("/vpc", aws.GetAWSVPC)
		awsGroup.GET("/iam", aws.GetAWSIAM)
		awsGroup.GET("/resources", aws.GetAWSResources)
		awsGroup.GET("/security", aws.GetAWSSecurity)
		awsGroup.GET("/recommendations", aws.GetAWSRecommendations)
	}

	// Cloud Connection Manager Endpoints
	r.GET("/cloud-connections", handlers.GetCloudConnections)
	r.POST("/cloud-connections/connect", handlers.ConnectCloudConnection)
	r.POST("/cloud-connections/test", handlers.TestCloudConnection)
	r.POST("/cloud-connections/disconnect", handlers.DisconnectCloudConnection)
	r.GET("/system/mode", handlers.GetSystemMode)
	r.POST("/system/mode", handlers.UpdateSystemMode)

	// API Group connection & status mappings
	apiGroup := r.Group("/api")
	{
		apiGroup.GET("/connections/docker/test", handlers.GetDockerConnectionTest)
		apiGroup.GET("/connections/kubernetes/test", handlers.GetK8sConnectionTest)
		apiGroup.GET("/connections/azure/test", handlers.GetAzureConnectionTest)
		apiGroup.GET("/connections/aws/test", handlers.GetAwsConnectionTest)

		apiGroup.GET("/connections/docker/status", handlers.GetDockerConnectionStatus)
		apiGroup.GET("/connections/kubernetes/status", handlers.GetK8sConnectionStatus)
		apiGroup.GET("/connections/azure/status", handlers.GetAzureConnectionStatus)
		apiGroup.GET("/connections/aws/status", handlers.GetAwsConnectionStatus)

		// Full Dashboard status aliases under /api
		apiGroup.GET("/aws/status", aws.GetAWSStatus)
		apiGroup.GET("/azure/status", azure.GetAzureStatus)
		apiGroup.GET("/docker/status", handlers.GetDockerStatus)
		apiGroup.GET("/k8s/status", handlers.GetK8sStatus)
	}

	// 6. Add startup logs:
	log.Println("[Connections] Registered:")
	log.Println("GET /api/connections/docker/test")
	log.Println("GET /api/connections/kubernetes/test")
	log.Println("GET /api/connections/azure/test")
	log.Println("GET /api/connections/aws/test")

	r.GET("/metrics", handlers.GetMetrics)
	r.GET("/metrics/historical", handlers.GetHistoricalMetrics)
	r.GET("/security/score", security.GetSecurityScore)
	r.GET("/security", handlers.GetSecurity)
	r.GET("/memory", handlers.GetMemory)
	r.GET("/memory/search", handlers.SearchMemory)
	r.GET("/memory/recent", handlers.GetRecentInvestigations)
	r.GET("/costs", handlers.GetCosts)
	r.GET("/topology", handlers.GetTopology)
	r.GET("/alerts", handlers.GetAlerts)
	r.GET("/investigations", handlers.GetInvestigations)
	r.GET("/recommendations", handlers.GetRecommendations)
	r.GET("/clusters", handlers.GetClusters)
	r.GET("/deployments", handlers.GetDeployments)

	r.POST("/ai/investigate", handlers.InvestigateIncident)
	r.GET("/ai/status", handlers.GetAIStatus)
	r.POST("/ai/copilot", handlers.Copilot)
	r.GET("/ai/copilot/history", handlers.GetCopilotHistory)
	r.DELETE("/ai/copilot/history/:id", handlers.DeleteCopilotHistory)

	return r
}
