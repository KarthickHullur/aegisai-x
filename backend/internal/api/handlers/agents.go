package handlers

import (
	"net/http"

	"aegisai-x/internal/database/postgres"

	"github.com/gin-gonic/gin"
)

func GetAgents(c *gin.Context) {
	rows, err := postgres.DB.Query("SELECT id, name, status, workload FROM agents ORDER BY id ASC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch agents: " + err.Error()})
		return
	}
	defer rows.Close()

	list := []gin.H{}
	for rows.Next() {
		var id, workload int
		var name, status string

		if err := rows.Scan(&id, &name, &status, &workload); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan agent: " + err.Error()})
			return
		}

		list = append(list, gin.H{
			"id":       id,
			"name":     name,
			"status":   status,
			"workload": workload,
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}
