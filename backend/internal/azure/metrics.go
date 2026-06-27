package azure

import (
	"context"
	"database/sql"
)

// PollMetrics refreshes metrics from Azure Monitor
func PollMetrics(ctx context.Context, db *sql.DB) error {
	client := GetClient()
	if client == nil || !client.Connected {
		return nil
	}
	// Dynamic metrics fetching logic can go here when connected
	return nil
}
