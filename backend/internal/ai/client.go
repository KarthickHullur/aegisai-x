package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"aegisai-x/internal/api/dto"

	"github.com/google/generative-ai-go/genai"
	"google.golang.org/api/option"
)

type AIClient interface {
	Generate(ctx context.Context, prompt string) (string, error)
	Chat(ctx context.Context, history []dto.ChatFragment, message, systemPrompt string) (string, error)
}

type mockClient struct{}

func (m *mockClient) Generate(ctx context.Context, prompt string) (string, error) {
	result := AnalysisResult{
		Summary:   "Mock analysis generated because no API keys are configured in the environment.",
		RootCause: "Simulated resource starvation or database locking under high concurrent transaction load.",
		Impact:    "Degraded performance on transactional checkout APIs, resulting in elevated query latency.",
		Recommendations: []string{
			"Increase container horizontal replica scaling threshold limit.",
			"Audit database lock contention and optimize index structures.",
			"Ensure proper query batching in microservices accessing metadata databases.",
		},
	}

	jsonData, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal mock response: %w", err)
	}

	return string(jsonData), nil
}

func (m *mockClient) Chat(ctx context.Context, history []dto.ChatFragment, message, systemPrompt string) (string, error) {
	msgLower := strings.ToLower(message)
	if strings.Contains(msgLower, "what is aws") {
		return "AWS (Amazon Web Services) is a secure cloud services platform, offering compute power, database storage, content delivery, and other functionality to help businesses scale and grow. Millions of customers use AWS cloud products and solutions to build sophisticated applications with increased flexibility, scalability, and reliability.", nil
	} else if strings.Contains(msgLower, "ec2") && strings.Contains(msgLower, "s3") {
		return "AWS EC2 (Elastic Compute Cloud) provides resizable virtual machine instances on-demand, suitable for hosting OS installations and running compute tasks. AWS S3 (Simple Storage Service) is an object storage system designed for static file storage (images, documents, backups) with high availability and simple HTTP query access. Use EC2 for hosting applications and S3 for storing file assets.", nil
	} else if strings.Contains(msgLower, "kubernetes") {
		return "Kubernetes (K8s) is an open-source container orchestration system for automating application deployment, scaling, and management. Originally developed by Google and now maintained by the CNCF, it allows SREs to run containerized microservices across cluster nodes with built-in self-healing, scaling, service discovery, and rolling deployments.", nil
	} else if strings.Contains(msgLower, "terraform") {
		return "Terraform is an open-source Infrastructure as Code (IaC) tool developed by HashiCorp. It enables you to define, provision, and version infrastructure across multiple cloud providers (like AWS, Azure, GCP) using high-level configuration syntax called HCL (HashiCorp Configuration Language).", nil
	} else if strings.Contains(msgLower, "docker") {
		return "Docker is a platform designed to help developers build, share, and run applications inside lightweight, portable containers. Popular commands include:\n- `docker run`: Run a container\n- `docker ps`: List active containers\n- `docker build`: Build an image from a Dockerfile\n- `docker compose up`: Run multi-container setups", nil
	} else if strings.Contains(msgLower, "interview") {
		return "Here are top AWS SRE Interview Questions:\n1. *How do you secure a VPC?* (Use security groups, NACLs, private subnets, and internet gateways).\n2. *What is the difference between IAM Roles and Users?* (Users are permanent credentials; Roles are assumed dynamically for temporary access).\n3. *How do you handle S3 bucket access restrictions?* (Configure S3 Bucket Policies and IAM user access policies).", nil
	}

	return "I am Cloud Copilot (Mock Fallback). You asked: '" + message + "'. Please configure a valid GEMINI_API_KEY inside your .env file to enable real Gemini conversation capabilities.", nil
}

type geminiClient struct {
	client *genai.Client
}

// NewAIClient instantiates the Gemini SDK client if keys are present, falling back to mock provider
func NewAIClient(ctx context.Context) (AIClient, error) {
	geminiKey := os.Getenv("GEMINI_API_KEY")
	log.Printf("[AI Client] GEMINI_API_KEY detected = %t", geminiKey != "")
	if geminiKey == "" {
		log.Println("[AI Client] GEMINI_API_KEY missing. Initializing fallback mock provider.")
		return &mockClient{}, nil
	}

	log.Println("[AI Client] Initializing Gemini SDK")
	log.Println("[AI Client] Using model: gemini-2.5-flash")
	client, err := genai.NewClient(ctx, option.WithAPIKey(geminiKey))
	if err != nil {
		return nil, fmt.Errorf("failed to create Gemini SDK client: %w", err)
	}

	return &geminiClient{client: client}, nil
}

// Generate sends a request to the Gemini SDK with automatic retry logic (3 attempts) and timeout
func (g *geminiClient) Generate(ctx context.Context, prompt string) (string, error) {
	var lastErr error

	for attempt := 1; attempt <= 3; attempt++ {
		log.Printf("[AI Client] Attempt %d: Sending prompt to gemini-2.5-flash", attempt)

		// Create timeout context specifically for this attempt (10s limit)
		attemptCtx, cancel := context.WithTimeout(ctx, 10*time.Second)

		model := g.client.GenerativeModel("gemini-2.5-flash")
		model.SetTemperature(0.2)
		model.ResponseMIMEType = "application/json"

		resp, err := model.GenerateContent(attemptCtx, genai.Text(prompt))
		cancel()

		if err == nil {
			if len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil || len(resp.Candidates[0].Content.Parts) == 0 {
				lastErr = fmt.Errorf("gemini returned empty generative response candidates")
				log.Printf("[AI Client] Attempt %d failed: %v", attempt, lastErr)
				continue
			}

			part := resp.Candidates[0].Content.Parts[0]
			text, ok := part.(genai.Text)
			if !ok {
				return "", fmt.Errorf("gemini returned unexpected non-text parts: %T", part)
			}

			log.Printf("[AI Client] Attempt %d succeeded.", attempt)
			return string(text), nil
		}

		lastErr = err
		log.Printf("[AI Client] Attempt %d failed: %v", attempt, err)
		
		// Backoff pause if we are retrying
		if attempt < 3 {
			time.Sleep(500 * time.Millisecond)
		}
	}

	return "", fmt.Errorf("gemini SDK failed after 3 attempts. Last error: %w", lastErr)
}

// Chat runs conversational sessions, passing the history list and message using gemini-2.5-flash
func (g *geminiClient) Chat(ctx context.Context, history []dto.ChatFragment, message, systemPrompt string) (string, error) {
	var lastErr error

	for attempt := 1; attempt <= 3; attempt++ {
		log.Printf("[AI Client] Chat Attempt %d: Sending prompt to gemini-2.5-flash", attempt)

		attemptCtx, cancel := context.WithTimeout(ctx, 15*time.Second)

		model := g.client.GenerativeModel("gemini-2.5-flash")
		model.SetTemperature(0.7) // Higher temperature for conversational flow
		model.SystemInstruction = genai.NewUserContent(genai.Text(systemPrompt))

		cs := model.StartChat()

		// Reconstruct history
		var genaiHistory []*genai.Content
		for _, frag := range history {
			role := frag.Role
			if role == "assistant" {
				role = "model"
			}
			genaiHistory = append(genaiHistory, &genai.Content{
				Role:  role,
				Parts: []genai.Part{genai.Text(frag.Content)},
			})
		}
		cs.History = genaiHistory

		resp, err := cs.SendMessage(attemptCtx, genai.Text(message))
		cancel()

		if err == nil {
			if len(resp.Candidates) == 0 || resp.Candidates[0].Content == nil || len(resp.Candidates[0].Content.Parts) == 0 {
				lastErr = fmt.Errorf("gemini returned empty chat response candidates")
				log.Printf("[AI Client] Chat Attempt %d failed: %v", attempt, lastErr)
				continue
			}

			part := resp.Candidates[0].Content.Parts[0]
			text, ok := part.(genai.Text)
			if !ok {
				return "", fmt.Errorf("gemini returned unexpected non-text parts: %T", part)
			}

			log.Printf("[AI Client] Chat Attempt %d succeeded.", attempt)
			return string(text), nil
		}

		lastErr = err
		log.Printf("[AI Client] Chat Attempt %d failed: %v", attempt, err)

		if attempt < 3 {
			time.Sleep(500 * time.Millisecond)
		}
	}

	return "", fmt.Errorf("gemini SDK Chat failed after 3 attempts. Last error: %w", lastErr)
}
