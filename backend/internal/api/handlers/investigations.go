package handlers

import (
	"fmt"
	"net/http"
	"time"

	"aegisai-x/internal/database/postgres"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

func GetInvestigations(c *gin.Context) {
	rows, err := postgres.DB.Query(`
		SELECT i.id, i.incident_id, inc.title, i.summary, i.root_cause, i.impact, i.recommendations, i.created_at
		FROM investigations i
		JOIN incidents inc ON i.incident_id = inc.id
		ORDER BY i.created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch investigations: " + err.Error()})
		return
	}
	defer rows.Close()

	list := []gin.H{}
	for rows.Next() {
		var id, incidentID int
		var title, summary, rootCause, impact string
		var recommendations []string
		var createdAt time.Time

		if err := rows.Scan(
			&id,
			&incidentID,
			&title,
			&summary,
			&rootCause,
			&impact,
			pq.Array(&recommendations),
			&createdAt,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan investigation: " + err.Error()})
			return
		}

		// Reconstruct format to match the frontend expects
		list = append(list, gin.H{
			"id":             id,
			"incident_id":    fmt.Sprintf("inc-%d", incidentID),
			"incident_title": title,
			"summary":        summary,
			"root_cause":     rootCause,
			"impact":         impact,
			"recommendations": recommendations,
			"timestamp":      createdAt.Format(time.RFC3339),
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}
