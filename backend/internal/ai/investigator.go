package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"text/template"

	_ "embed"
)

//go:embed prompts/incident_analysis.txt
var incidentAnalysisPromptTemplate string

type AnalysisResult struct {
	Summary         string   `json:"summary"`
	RootCause       string   `json:"rootCause"`
	Impact          string   `json:"impact"`
	Recommendations []string `json:"recommendations"`
}

type Investigator struct {
	client AIClient
}

func NewInvestigator(client AIClient) *Investigator {
	return &Investigator{client: client}
}

// Investigate builds the prompt (injecting historical recall details), sends it to the client, and returns parsed results
func (i *Investigator) Investigate(ctx context.Context, incident, severity, logs, historicalIncidents string) (*AnalysisResult, error) {
	tmpl, err := template.New("analysis").Parse(incidentAnalysisPromptTemplate)
	if err != nil {
		return nil, fmt.Errorf("failed to parse prompt template: %w", err)
	}

	data := struct {
		Incident            string
		Severity            string
		Logs                string
		HistoricalIncidents string
	}{
		Incident:            incident,
		Severity:            severity,
		Logs:                logs,
		HistoricalIncidents: historicalIncidents,
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, fmt.Errorf("failed to execute prompt template: %w", err)
	}

	rawResponse, err := i.client.Generate(ctx, buf.String())
	if err != nil {
		return nil, fmt.Errorf("ai generation failed: %w", err)
	}

	cleanJSON := cleanJSONResponse(rawResponse)

	var result AnalysisResult
	if err := json.Unmarshal([]byte(cleanJSON), &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON response (raw: %q, clean: %q): %w", rawResponse, cleanJSON, err)
	}

	return &result, nil
}

func cleanJSONResponse(raw string) string {
	cleaned := strings.TrimSpace(raw)
	if strings.HasPrefix(cleaned, "```json") {
		cleaned = strings.TrimPrefix(cleaned, "```json")
		cleaned = strings.TrimSuffix(cleaned, "```")
	} else if strings.HasPrefix(cleaned, "```") {
		cleaned = strings.TrimPrefix(cleaned, "```")
		cleaned = strings.TrimSuffix(cleaned, "```")
	}
	return strings.TrimSpace(cleaned)
}
