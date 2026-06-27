package dto

type ChatFragment struct {
	Role    string `json:"role"`    // "user" or "model"
	Content string `json:"content"`
}

type AICopilotRequest struct {
	Message string         `json:"message" binding:"required"`
	History []ChatFragment `json:"history"`
}

type AICopilotResponse struct {
	Answer string `json:"answer"`
}
