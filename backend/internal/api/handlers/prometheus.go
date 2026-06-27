package handlers

import (
	"context"
	"fmt"
	"math/rand"
	"net/http"
	"time"

	"aegisai-x/internal/prometheus"

	"github.com/gin-gonic/gin"
)

func GetPrometheusStatus(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	status := prometheus.GetStatus(ctx)
	c.JSON(http.StatusOK, status)
}

func QueryPrometheus(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	query := c.Query("query")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'query' is required"})
		return
	}

	result, err := prometheus.QueryInstant(ctx, query)
	if err != nil {
		// Graceful degradation fallback: return mock vector response
		rSource := rand.NewSource(time.Now().UnixNano())
		r := rand.New(rSource)
		val := fmt.Sprintf("%d", 100+r.Intn(50))
		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"data": gin.H{
				"resultType": "vector",
				"result": []gin.H{
					{
						"metric": gin.H{
							"__name__": query,
							"instance": "localhost:9090",
							"job":      "prometheus",
						},
						"value": []interface{}{time.Now().Unix(), val},
					},
				},
			},
			"degraded": true,
			"warning":  "Prometheus server is offline. Serving mock telemetry fallback.",
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

func QueryRangePrometheus(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	query := c.Query("query")
	start := c.Query("start")
	end := c.Query("end")
	step := c.Query("step")

	if query == "" || start == "" || end == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Parameters 'query', 'start', and 'end' are required"})
		return
	}
	if step == "" {
		step = "15s"
	}

	result, err := prometheus.QueryRange(ctx, query, start, end, step)
	if err != nil {
		// Graceful degradation fallback: return mock matrix response
		startTime, _ := time.Parse(time.RFC3339, start)
		endTime, _ := time.Parse(time.RFC3339, end)
		if startTime.IsZero() {
			startTime = time.Now().Add(-1 * time.Hour)
		}
		if endTime.IsZero() {
			endTime = time.Now()
		}

		rSource := rand.NewSource(time.Now().UnixNano())
		r := rand.New(rSource)

		var values [][]interface{}
		current := startTime
		for current.Before(endTime) {
			val := fmt.Sprintf("%.2f", 20.0+r.Float64()*10.0)
			values = append(values, []interface{}{current.Unix(), val})
			current = current.Add(15 * time.Second)
		}

		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"data": gin.H{
				"resultType": "matrix",
				"result": []gin.H{
					{
						"metric": gin.H{
							"__name__": query,
							"instance": "localhost:9090",
							"job":      "prometheus",
						},
						"values": values,
					},
				},
			},
			"degraded": true,
			"warning":  "Prometheus server is offline. Serving mock telemetry fallback.",
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

func GetPrometheusAlerts(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	alerts, err := prometheus.GetAlerts(ctx)
	if err != nil {
		// Graceful degradation fallback: empty alerts list
		c.JSON(http.StatusOK, gin.H{
			"status":   "success",
			"data":     gin.H{"alerts": []interface{}{}},
			"degraded": true,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   gin.H{"alerts": alerts},
	})
}

func GetPrometheusMetricsList(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	metrics, err := prometheus.GetMetricsList(ctx)
	if err != nil {
		// Graceful degradation fallback: return a few standard mock metrics names
		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"data": []string{
				"up",
				"prometheus_http_requests_total",
				"node_cpu_seconds_total",
				"node_memory_Active_bytes",
			},
			"degraded": true,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   metrics,
	})
}
