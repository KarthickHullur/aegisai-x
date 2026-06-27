package kubernetes

import (
	"context"
	"database/sql"
	"log"
	"sync"
	"time"
)

// StartPolling initiates the background K8s poller
func StartPolling(db *sql.DB) {
	_, err := db.Exec("DELETE FROM incidents WHERE source = 'kubernetes' AND status = 'Open'")
	if err == nil {
		log.Println("[K8s Poller] Cleaned up legacy open kubernetes incidents from database.")
	}

	InitK8sClient()

	ticker := time.NewTicker(15 * time.Second)
	go func() {
		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
			PollKubernetes(ctx, db)
			cancel()
		}
	}()
}

var (
	lastRetryTime time.Time
	updateHook    func()
	hookMu        sync.RWMutex
)

func RegisterUpdateHook(cb func()) {
	hookMu.Lock()
	defer hookMu.Unlock()
	updateHook = cb
}

func triggerUpdate() {
	hookMu.RLock()
	cb := updateHook
	hookMu.RUnlock()
	if cb != nil {
		cb()
	}
}

func PollKubernetes(ctx context.Context, db *sql.DB) {
	if IsPollingPaused() {
		if time.Since(lastRetryTime) >= 30*time.Second {
			lastRetryTime = time.Now()
			log.Println("[K8s Poller Warning] Polling is paused. Retrying cluster ping/reconnection...")
			err := InitK8sClient()
			if err == nil {
				ResumePolling()
			}
		}
		return
	}

	status := GetK8sStatus(ctx)
	if !status.Connected {
		PausePolling()
		lastRetryTime = time.Now()
		return
	}

	c := GetClientset()
	if c == nil {
		PausePolling()
		lastRetryTime = time.Now()
		return
	}

	// Collect and save metrics
	CollectAndSaveMetrics(ctx, db)

	// Monitor pods and nodes state transitions
	checkIncidents(ctx, db, c)
	triggerUpdate()
}
