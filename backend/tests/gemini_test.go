package tests

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"aegisai-x/internal/ai"
	"aegisai-x/internal/api/handlers"
	"aegisai-x/internal/database/migrations"
	"aegisai-x/internal/database/postgres"

	"github.com/gin-gonic/gin"
)

func TestGeminiClientRoutingAndFallback(t *testing.T) {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	// 1. Verify Fallback Client Initialization
	t.Setenv("GEMINI_API_KEY", "")
	ctx := context.Background()
	client, err := ai.NewAIClient(ctx)
	if err != nil {
		t.Fatalf("Failed to initialize AI Client: %v", err)
	}

	resultText, err := client.Generate(ctx, "Test Prompt")
	if err != nil {
		t.Fatalf("Fallback AI generation failed: %v", err)
	}

	if !strings.Contains(resultText, "Mock analysis generated") {
		t.Errorf("Expected fallback client mock payload, got %q", resultText)
	}

	// 2. Setup mock DB for handler execution
	dbHost := os.Getenv("DB_HOST")
	if dbHost != "" {
		_ = postgres.InitDB()
		_ = migrations.RunMigrations(postgres.DB)
	}

	// 3. Test HTTP request execution to handler
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	// Mock request payload
	reqBody := `{"incident": "Checkout slow load", "severity": "High", "logs": "Timeout after 15s"}`
	c.Request, _ = http.NewRequest("POST", "/ai/investigate", strings.NewReader(reqBody))
	c.Request.Header.Set("Content-Type", "application/json")

	// Invoke handler
	if postgres.DB != nil {
		handlers.InvestigateIncident(c)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status code 200, got %d. Response: %s", w.Code, w.Body.String())
		}
	}
}
