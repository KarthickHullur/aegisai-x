package security

import (
	"context"
	"database/sql"
	"log"
	"sync"
	"time"
)

var (
	cachedScore SecurityScoreResponse
	scoreMu     sync.RWMutex
	dbConn      *sql.DB
	triggerChan = make(chan struct{}, 1)
)

// TriggerRecalculate requests an immediate score recalculation
func TriggerRecalculate() {
	select {
	case triggerChan <- struct{}{}:
	default:
	}
}

// StartEngine starts the background security scoring ticker
func StartEngine(db *sql.DB) {
	dbConn = db
	log.Println("[Security] Initializing scoring engine...")
	log.Println("[Security] Loading vulnerability findings...")
	log.Println("[Security] Security score service started.")

	// Perform first run
	recalculate()

	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				recalculate()
			case <-triggerChan:
				recalculate()
			}
		}
	}()
}

func recalculate() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if dbConn == nil {
		return
	}

	score, err := CalculateScore(ctx, dbConn)
	if err != nil {
		log.Printf("[Security Error] Recalculation failed: %v", err)
		return
	}

	scoreMu.Lock()
	cachedScore = score
	scoreMu.Unlock()

	log.Printf("[Security] Score recalculated: %d/100 (%s)", score.Score, score.Grade)
}

// GetCachedScore returns the last calculated score
func GetCachedScore() SecurityScoreResponse {
	scoreMu.RLock()
	defer scoreMu.RUnlock()

	if cachedScore.LastUpdated.IsZero() {
		return SecurityScoreResponse{
			Score:       100,
			Grade:       "Excellent",
			LastUpdated: time.Now(),
		}
	}
	return cachedScore
}
