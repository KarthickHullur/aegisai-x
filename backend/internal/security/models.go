package security

import "time"

type SecurityBreakdownItem struct {
	Name   string  `json:"name"`
	Status string  `json:"status"`
	Points float64 `json:"points"`
}

type SecurityScoreResponse struct {
	Score                 int                     `json:"score"`
	Grade                 string                  `json:"grade"`
	Critical              int                     `json:"critical"`
	High                  int                     `json:"high"`
	Medium                int                     `json:"medium"`
	Low                   int                     `json:"low"`
	Environment           string                  `json:"environment"`
	Reason                string                  `json:"reason"`
	DockerFindingsPenalty float64                 `json:"dockerFindingsPenalty"`
	K8sFindingsPenalty    float64                 `json:"k8sFindingsPenalty"`
	DevAdjustments        float64                 `json:"devAdjustments"`
	Breakdown             []SecurityBreakdownItem `json:"breakdown"`
	LastUpdated           time.Time               `json:"lastUpdated"`
}
