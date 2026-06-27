package handlers

import (
	"context"
	"log"
	"net/http"
	"time"

	"aegisai-x/internal/ai"
	"aegisai-x/internal/api/dto"
	"aegisai-x/internal/database/postgres"

	"github.com/gin-gonic/gin"
)

const CopilotSystemPrompt = "You are Cloud Copilot, an expert cloud, DevOps, Kubernetes, AWS, Azure, Terraform, Docker, Linux, networking, security, and SRE assistant. Provide clear, accurate, beginner-friendly explanations when appropriate and advanced technical guidance when requested."

func Copilot(c *gin.Context) {
	var req dto.AICopilotRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Initialize the active AI client
	client, err := ai.NewAIClient(ctx)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "AI Config Error: " + err.Error(),
		})
		return
	}

	log.Printf("[Cloud Copilot] Processing message: %q with %d history fragments", req.Message, len(req.History))

	// Execute Gemini SDK chat session
	answer, err := client.Chat(ctx, req.History, req.Message, CopilotSystemPrompt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "AI Assistant failed: " + err.Error(),
		})
		return
	}

	// Persist QA pair to cloud_copilot_sessions table
	query := "INSERT INTO cloud_copilot_sessions (question, response, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP)"
	_, dbErr := postgres.DB.ExecContext(ctx, query, req.Message, answer)
	if dbErr != nil {
		log.Printf("[Database Error] Failed to persist copilot session: %v", dbErr)
	} else {
		log.Printf("[Database Success] Saved copilot Q&A exchange to PostgreSQL.")
	}

	c.JSON(http.StatusOK, dto.AICopilotResponse{
		Answer: answer,
	})
}

func GetCopilotHistory(c *gin.Context) {
	rows, err := postgres.DB.Query(`
		SELECT id, question, response, created_at
		FROM cloud_copilot_sessions
		ORDER BY created_at DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch copilot history: " + err.Error()})
		return
	}
	defer rows.Close()

	list := []gin.H{}
	for rows.Next() {
		var id int
		var question, response string
		var createdAt time.Time

		if err := rows.Scan(&id, &question, &response, &createdAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan copilot session: " + err.Error()})
			return
		}

		list = append(list, gin.H{
			"id":         id,
			"question":   question,
			"response":   response,
			"created_at": createdAt.Format(time.RFC3339),
		})
	}

	c.JSON(http.StatusOK, gin.H{"data": list})
}

func DeleteCopilotHistory(c *gin.Context) {
	id := c.Param("id")
	_, err := postgres.DB.Exec("DELETE FROM cloud_copilot_sessions WHERE id = $1", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete session: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Session deleted successfully"})
}
