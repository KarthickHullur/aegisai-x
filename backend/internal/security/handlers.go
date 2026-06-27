package security

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetSecurityScore serves GET /security/score
func GetSecurityScore(c *gin.Context) {
	score := GetCachedScore()
	c.JSON(http.StatusOK, score)
}
