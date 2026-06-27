package ai

import (
	"context"
	"strings"
	"testing"
)

func TestMockAIClientFallback(t *testing.T) {
	// Clear keys to force fallback behavior
	t.Setenv("GEMINI_API_KEY", "")
	t.Setenv("OPENAI_API_KEY", "")

	client, err := NewAIClient(context.Background())
	if err != nil {
		t.Fatalf("Failed to initialize AI Client: %v", err)
	}

	// Verify mock client type
	if _, ok := client.(*mockClient); !ok {
		t.Fatalf("Expected fallback client of type *mockClient, got %T", client)
	}

	investigator := NewInvestigator(client)
	ctx := context.Background()

	result, err := investigator.Investigate(
		ctx,
		"CPU Spike on order-service pod",
		"High",
		"Container restarted 5 times. CPU usage exceeded 95%.",
		"",
	)
	if err != nil {
		t.Fatalf("Investigation execution failed: %v", err)
	}

	if !strings.Contains(result.Summary, "Mock analysis generated") {
		t.Errorf("Expected summary to contain 'Mock analysis generated', got %q", result.Summary)
	}

	if len(result.Recommendations) == 0 {
		t.Errorf("Expected recommendations to be populated, got empty list")
	}

	t.Logf("Generated Summary: %s", result.Summary)
	t.Logf("Root Cause: %s", result.RootCause)
	t.Logf("Impact: %s", result.Impact)
	t.Logf("Recommendations: %v", result.Recommendations)
}
