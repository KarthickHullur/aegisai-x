package handlers

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"aegisai-x/internal/database/postgres"

	"github.com/gin-gonic/gin"
)

func GetIncidents(c *gin.Context) {
	rows, err := postgres.DB.Query(`
		SELECT id, COALESCE(incident_id, ''), title, source, severity, logs, status, occurrence_count, first_seen, last_seen, created_at
		FROM incidents
		ORDER BY last_seen DESC
	`)
	if err != nil {
		log.Printf("[Incidents API] Failed\nReason: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch incidents: " + err.Error()})
		return
	}
	defer rows.Close()

	list := []gin.H{}
	for rows.Next() {
		var id int
		var incidentIDCode, title, source, severity, logs, status string
		var occurrenceCount int
		var firstSeen, lastSeen, createdAt time.Time

		if err := rows.Scan(&id, &incidentIDCode, &title, &source, &severity, &logs, &status, &occurrenceCount, &firstSeen, &lastSeen, &createdAt); err != nil {
			log.Printf("[Incidents API] Failed\nReason: scan error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan incident: " + err.Error()})
			return
		}

		if incidentIDCode == "" {
			incidentIDCode = fmt.Sprintf("INC-%04d", id)
		}

		// Map to match frontend fields
		list = append(list, gin.H{
			"id":               id,
			"incident_code":    incidentIDCode,
			"title":            title,
			"source":           source,
			"severity":         severity,
			"status":           status,
			"occurrence_count": occurrenceCount,
			"logs":             logs,
			"first_seen":       firstSeen.Format(time.RFC3339),
			"last_seen":        lastSeen.Format(time.RFC3339),
			"time":             lastSeen.Format(time.RFC3339), // friendly fallback
			"created_at":       createdAt.Format(time.RFC3339),
		})
	}

	log.Printf("[Incidents API] Query Successful\nReturned: %d incidents", len(list))
	c.JSON(http.StatusOK, gin.H{"data": list})
}
