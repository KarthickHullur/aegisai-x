package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"aegisai-x/internal/ai"
	"aegisai-x/internal/api/dto"
	"aegisai-x/internal/database/postgres"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
)

func InvestigateIncident(c *gin.Context) {
	var req dto.AIInvestigateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 35*time.Second)
	defer cancel()

	// 1. AI Memory Recall: Search PostgreSQL for similar historical incidents
	var historicalContext strings.Builder
	matches, err := postgres.SearchMemory(req.Incident)
	if err != nil {
		log.Printf("[AI Investigator] Failed to search historical memory: %v", err)
	} else if len(matches) > 0 {
		log.Printf("[AI Investigator] Found %d matching historical incidents for recall.", len(matches))
		historicalContext.WriteString("Similar historical incidents context:\n")
		for idx, match := range matches {
			historicalContext.WriteString(fmt.Sprintf("- Historical Incident #%d: %s\n", idx+1, match.IncidentTitle))
			historicalContext.WriteString(fmt.Sprintf("  Summary: %s\n", match.Summary))
			historicalContext.WriteString(fmt.Sprintf("  Root Cause: %s\n", match.RootCause))
			historicalContext.WriteString(fmt.Sprintf("  Remediation Actions: %s\n\n", strings.Join(match.Recommendations, ", ")))
		}
	} else {
		log.Println("[AI Investigator] No historical memory matches found.")
	}

	// 2. Initialize the AI client (will dynamically select Gemini SDK or fall back to mock client)
	client, err := ai.NewAIClient(ctx)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "AI Config Error: " + err.Error(),
		})
		return
	}

	investigator := ai.NewInvestigator(client)

	// 3. Execute prompt generation and analysis
	result, err := investigator.Investigate(ctx, req.Incident, req.Severity, req.Logs, historicalContext.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "AI Investigation failed: " + err.Error(),
		})
		return
	}

	// 4. Persistence: Insert incident and investigation output into PostgreSQL
	var incidentID int
	var currentLogs string
	var currentCount int
	
	source := determineSource(req.Incident)
	queryCheck := "SELECT id, logs, occurrence_count FROM incidents WHERE LOWER(title) = LOWER($1) AND LOWER(source) = LOWER($2) AND LOWER(severity) = LOWER($3) AND status = 'Open' LIMIT 1"
	err = postgres.DB.QueryRowContext(ctx, queryCheck, req.Incident, source, req.Severity).Scan(&incidentID, &currentLogs, &currentCount)
	
	if err == nil {
		// Incident exists and is Open: Update it
		newCount := currentCount + 1
		analysisAppend := fmt.Sprintf("\n\n--- [Analysis: %s] ---\nSummary: %s\nRoot Cause: %s\nImpact: %s\nRecommendations: %s",
			time.Now().UTC().Format(time.RFC3339),
			result.Summary,
			result.RootCause,
			result.Impact,
			strings.Join(result.Recommendations, ", "),
		)
		newLogs := currentLogs + analysisAppend
		queryUpdate := "UPDATE incidents SET occurrence_count = $1, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, logs = $2 WHERE id = $3"
		_, err = postgres.DB.ExecContext(ctx, queryUpdate, newCount, newLogs, incidentID)
		if err != nil {
			log.Printf("[Database Error] Failed to update existing incident: %v", err)
		} else {
			log.Printf("[Database Success] Updated duplicate incident #%d (occurrence %d)", incidentID, newCount)
		}
	} else {
		// Incident does not exist or is not Open: Insert it
		queryInsert := `
			INSERT INTO incidents (title, source, severity, logs, status, occurrence_count, first_seen, last_seen, created_at, updated_at)
			VALUES ($1, $2, $3, $4, 'Open', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			RETURNING id
		`
		err = postgres.DB.QueryRowContext(ctx, queryInsert, req.Incident, source, req.Severity, req.Logs).Scan(&incidentID)
		if err != nil {
			log.Printf("[Database Error] Failed to insert new incident: %v", err)
		} else {
			// Update the generated incident_id (INC-xxxx)
			incidentCode := fmt.Sprintf("INC-%04d", incidentID)
			_, err = postgres.DB.ExecContext(ctx, "UPDATE incidents SET incident_id = $1 WHERE id = $2", incidentCode, incidentID)
			if err != nil {
				log.Printf("[Database Error] Failed to set incident_id code: %v", err)
			} else {
				log.Printf("[Database Success] Generated incident code %s for incident #%d", incidentCode, incidentID)
			}
		}
	}

	if err == nil || incidentID > 0 {
		queryInvestigation := `
			INSERT INTO investigations (incident_id, summary, root_cause, impact, recommendations, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`
		_, err = postgres.DB.ExecContext(
			ctx,
			queryInvestigation,
			incidentID,
			result.Summary,
			result.RootCause,
			result.Impact,
			pq.Array(result.Recommendations),
		)
		if err != nil {
			log.Printf("[Database Error] Failed to persist investigation results: %v", err)
		} else {
			log.Printf("[Database Success] Saved investigation for incident #%d to PostgreSQL.", incidentID)
		}
	}

	// 5. Respond to frontend
	c.JSON(http.StatusOK, dto.AIInvestigateResponse{
		Summary:         result.Summary,
		RootCause:       result.RootCause,
		Impact:          result.Impact,
		Recommendations: result.Recommendations,
	})
}

func GetAIStatus(c *gin.Context) {
	geminiKey := os.Getenv("GEMINI_API_KEY")
	if geminiKey != "" {
		c.JSON(http.StatusOK, gin.H{
			"provider": "gemini",
			"model":    "gemini-2.5-flash",
			"status":   "active",
		})
	} else {
		c.JSON(http.StatusOK, gin.H{
			"provider": "mock",
			"status":   "fallback",
		})
	}
}

func determineSource(title string) string {
	titleLower := strings.ToLower(title)
	if strings.Contains(titleLower, "cpu") || strings.Contains(titleLower, "thread") {
		return "kube-us-east-cluster"
	}
	if strings.Contains(titleLower, "memory") || strings.Contains(titleLower, "db") || strings.Contains(titleLower, "aurora") || strings.Contains(titleLower, "postgres") || strings.Contains(titleLower, "rds") {
		return "rds-aurora-postgres"
	}
	if strings.Contains(titleLower, "cert") || strings.Contains(titleLower, "tls") || strings.Contains(titleLower, "ssl") {
		return "cert-manager-production"
	}
	if strings.Contains(titleLower, "s3") || strings.Contains(titleLower, "bucket") {
		return "s3-backup-storage"
	}
	if strings.Contains(titleLower, "gateway") || strings.Contains(titleLower, "ingress") || strings.Contains(titleLower, "network") {
		return "ingress-nginx-controller"
	}
	return "system-monitor"
}
