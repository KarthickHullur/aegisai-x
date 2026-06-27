package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetCosts(c *gin.Context) {
	opportunities := []gin.H{
		{
			"id":             "cost-1",
			"resource_name":  "staging-rds-postgres",
			"category":       "Database",
			"waste_reason":   "CPU utilization <3% for 14 days",
			"recommendation": "Downscale from db.t3.medium to db.t3.micro",
			"monthly_savings": 320.00,
			"status":         "Pending",
		},
		{
			"id":             "cost-2",
			"resource_name":  "vol-09ea382b9a7c",
			"category":       "Storage",
			"waste_reason":   "Detached EBS Volume, unattached for 30 days",
			"recommendation": "Delete detached EBS volume",
			"monthly_savings": 45.00,
			"status":         "Pending",
		},
		{
			"id":             "cost-3",
			"resource_name":  "k8s-perf-testing-pool",
			"category":       "Compute Set",
			"waste_reason":   "Idle replica pool over weekend",
			"recommendation": "Configure weekend scale-down rule",
			"monthly_savings": 740.00,
			"status":         "Pending",
		},
		{
			"id":             "cost-4",
			"resource_name":  "s3-analytics-raw-temp",
			"category":       "Object Cache",
			"waste_reason":   "No lifecycle rule configured",
			"recommendation": "Transition to Glacier Deep Archive after 7 days",
			"monthly_savings": 120.00,
			"status":         "Applied",
		},
	}

	var potentialSavings, appliedSavings float64
	var activeWasteCount int

	for _, o := range opportunities {
		savings := o["monthly_savings"].(float64)
		status := o["status"].(string)
		if status == "Applied" {
			appliedSavings += savings
		} else if status == "Pending" {
			potentialSavings += savings
			activeWasteCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"potential_savings_monthly": potentialSavings,
		"active_waste_count":        activeWasteCount,
		"efficiency_index":          84.0,
		"applied_savings_monthly":   appliedSavings,
		"opportunities":             opportunities,
	})
}
