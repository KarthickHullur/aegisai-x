package selfhealing

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"

	"github.com/gin-gonic/gin"
)

// RunSelfTests executes internal HTTP requests against the active routes to verify API status on startup
func RunSelfTests(r *gin.Engine) {
	endpoints := []string{
		"/health",
		"/incidents",
		"/agents",
		"/resources",
		"/metrics",
		"/security",
		"/security/score",
		"/memory",
		"/costs",
		"/alerts",
		"/topology",
		"/docker/status",
		"/k8s/status",
		"/prometheus/status",
		"/prometheus/alerts",
		"/prometheus/metrics",
	}

	for _, ep := range endpoints {
		req, err := http.NewRequest("GET", ep, nil)
		if err != nil {
			log.Printf("[Self Test] FAIL %s\nReason: failed to create request: %v", ep, err)
			continue
		}

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code == http.StatusOK {
			log.Printf("[Self Test] PASS %s", ep)
		} else {
			// Extract error detail from response body if possible
			log.Printf("[Self Test] FAIL %s\nReason: HTTP Status %d - %s", ep, w.Code, stringsTrimNewline(w.Body.String()))
		}
	}
}

func stringsTrimNewline(s string) string {
	s = fmt.Sprintf("%s", s)
	s = filepathCleanResponse(s)
	return s
}

func filepathCleanResponse(s string) string {
	// A helper to make the log format compact and clean
	s = fmt.Sprintf("%q", s)
	if len(s) > 120 {
		return s[:120] + "..."
	}
	return s
}
