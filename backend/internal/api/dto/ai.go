package dto

type AIInvestigateRequest struct {
	Incident string `json:"incident" binding:"required"`
	Severity string `json:"severity" binding:"required"`
	Logs     string `json:"logs" binding:"required"`
}

type AIInvestigateResponse struct {
	Summary         string   `json:"summary"`
	RootCause       string   `json:"rootCause"`
	Impact          string   `json:"impact"`
	Recommendations []string `json:"recommendations"`
}
