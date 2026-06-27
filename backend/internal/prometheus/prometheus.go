package prometheus

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"aegisai-x/internal/ai"
	"aegisai-x/internal/database/postgres"
	"aegisai-x/internal/kubernetes"
)

type PrometheusStatusResponse struct {
	Connected      bool    `json:"connected"`
	Version        string  `json:"version,omitempty"`
	ActiveAlerts   int     `json:"activeAlerts"`
	MetricsCount   int     `json:"metricsCount"`
	TargetsTotal   int     `json:"targetsTotal"`
	TargetsHealthy int     `json:"targetsHealthy"`
	QueryLatencyMs float64 `json:"queryLatencyMs"`
	Error          string  `json:"error,omitempty"`
}

type PrometheusAlert struct {
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	State       string            `json:"state"`
	ActiveAt    string            `json:"activeAt"`
	Value       string            `json:"value"`
}

var (
	baseURL      = "http://localhost:9090"
	client       = &http.Client{Timeout: 5 * time.Second}
	mu           sync.RWMutex
	updateHook   func()
	hookMu       sync.RWMutex
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

// GetStatus checks Prometheus build info and active alerts counts
func GetStatus(ctx context.Context) PrometheusStatusResponse {
	mu.RLock()
	urlStr := baseURL
	mu.RUnlock()

	// Check build info
	req, err := http.NewRequestWithContext(ctx, "GET", urlStr+"/api/v1/status/buildinfo", nil)
	if err != nil {
		return PrometheusStatusResponse{Connected: false, Error: err.Error()}
	}

	resp, err := client.Do(req)
	if err != nil {
		return PrometheusStatusResponse{Connected: false, Error: "Prometheus connection refused: " + err.Error()}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return PrometheusStatusResponse{Connected: false, Error: fmt.Sprintf("Prometheus returned status %d", resp.StatusCode)}
	}

	var buildInfo struct {
		Status string `json:"status"`
		Data   struct {
			Version string `json:"version"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&buildInfo); err != nil {
		return PrometheusStatusResponse{Connected: false, Error: "Failed to decode build info: " + err.Error()}
	}

	// Fetch active alerts count
	alerts, _ := GetAlerts(ctx)
	activeAlertsCount := 0
	for _, a := range alerts {
		if a.State == "firing" {
			activeAlertsCount++
		}
	}

	// Fetch active metrics count
	metrics, _ := GetMetricsList(ctx)

	var targetsTotal, targetsHealthy int
	var queryLatencyMs float64
	if postgres.DB != nil {
		_ = postgres.DB.QueryRow("SELECT targets_total, targets_healthy, query_latency_ms FROM prometheus_snapshots ORDER BY created_at DESC LIMIT 1").Scan(&targetsTotal, &targetsHealthy, &queryLatencyMs)
	}

	return PrometheusStatusResponse{
		Connected:      true,
		Version:        buildInfo.Data.Version,
		ActiveAlerts:   activeAlertsCount,
		MetricsCount:   len(metrics),
		TargetsTotal:   targetsTotal,
		TargetsHealthy: targetsHealthy,
		QueryLatencyMs: queryLatencyMs,
	}
}

// GetAlerts fetches active alerts from Prometheus
func GetAlerts(ctx context.Context) ([]PrometheusAlert, error) {
	mu.RLock()
	urlStr := baseURL
	mu.RUnlock()

	req, err := http.NewRequestWithContext(ctx, "GET", urlStr+"/api/v1/alerts", nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("alerts query returned HTTP %d", resp.StatusCode)
	}

	var payload struct {
		Status string `json:"status"`
		Data   struct {
			Alerts []PrometheusAlert `json:"alerts"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return payload.Data.Alerts, nil
}

// GetMetricsList fetches active metric names
func GetMetricsList(ctx context.Context) ([]string, error) {
	mu.RLock()
	urlStr := baseURL
	mu.RUnlock()

	req, err := http.NewRequestWithContext(ctx, "GET", urlStr+"/api/v1/label/__name__/values", nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("metrics labels query returned HTTP %d", resp.StatusCode)
	}

	var payload struct {
		Status string   `json:"status"`
		Data   []string `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return payload.Data, nil
}

// QueryInstant runs an instant vector query against Prometheus
func QueryInstant(ctx context.Context, query string) (interface{}, error) {
	mu.RLock()
	urlStr := baseURL
	mu.RUnlock()

	apiURL := fmt.Sprintf("%s/api/v1/query?query=%s", urlStr, url.QueryEscape(query))
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("instant query returned HTTP %d", resp.StatusCode)
	}

	var payload interface{}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return payload, nil
}

// QueryRange runs a range matrix query against Prometheus
func QueryRange(ctx context.Context, query, start, end, step string) (interface{}, error) {
	mu.RLock()
	urlStr := baseURL
	mu.RUnlock()

	apiURL := fmt.Sprintf("%s/api/v1/query_range?query=%s&start=%s&end=%s&step=%s",
		urlStr, url.QueryEscape(query), url.QueryEscape(start), url.QueryEscape(end), url.QueryEscape(step))
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("range query returned HTTP %d", resp.StatusCode)
	}

	var payload interface{}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return payload, nil
}

// StartPolling runs the background Prometheus poller
func StartPolling(db *sql.DB) {
	_, err := db.Exec("DELETE FROM incidents WHERE source = 'prometheus' AND status = 'Open'")
	if err == nil {
		log.Println("[Prometheus Poller] Cleaned up legacy open prometheus incidents from database.")
	}

	ticker := time.NewTicker(15 * time.Second)
	go func() {
		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
			pollPrometheusAlerts(ctx, db)
			pollInfrastructureMetricsAndSaveSnapshots(ctx, db)
			cancel()
		}
	}()
}

func pollPrometheusAlerts(ctx context.Context, db *sql.DB) {
	status := GetStatus(ctx)
	if !status.Connected {
		return
	}

	alerts, err := GetAlerts(ctx)
	if err != nil {
		log.Printf("[Prometheus Poller Warning] Failed to fetch alerts: %v", err)
		return
	}

	for _, a := range alerts {
		if a.State != "firing" {
			continue
		}

		alertName := a.Labels["alertname"]
		if alertName == "" {
			alertName = "Generic Prometheus Alert"
		}

		severity := "High"
		if s, ok := a.Labels["severity"]; ok {
			sLower := strings.ToLower(s)
			if sLower == "critical" || sLower == "fatal" {
				severity = "Critical"
			} else if sLower == "warning" {
				severity = "Medium"
			} else if sLower == "info" {
				severity = "Info"
			}
		}

		description := a.Annotations["description"]
		if description == "" {
			description = a.Annotations["summary"]
		}
		if description == "" {
			description = fmt.Sprintf("Prometheus alert '%s' is firing in state '%s'. labels: %v", alertName, a.State, a.Labels)
		}

		CreateOrUpdatePrometheusIncident(ctx, db, alertName, severity, description, a.Labels)
	}
}

func CreateOrUpdatePrometheusIncident(ctx context.Context, db *sql.DB, title, severity, logs string, labels map[string]string) {
	var incidentID int
	var currentCount int

	queryCheck := "SELECT id, occurrence_count FROM incidents WHERE title = $1 AND source = 'prometheus' AND status = 'Open' LIMIT 1"
	err := db.QueryRow(queryCheck, title).Scan(&incidentID, &currentCount)

	if err == nil {
		newCount := currentCount + 1
		queryUpdate := "UPDATE incidents SET occurrence_count = $1, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2"
		_, _ = db.Exec(queryUpdate, newCount, incidentID)
		log.Printf("[Prometheus Integration] Updated existing incident %s (occurrences: %d)", title, newCount)
	} else {
		queryInsert := `
			INSERT INTO incidents (title, source, severity, logs, status, occurrence_count, first_seen, last_seen, created_at, updated_at)
			VALUES ($1, 'prometheus', $2, $3, 'Open', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			RETURNING id
		`
		var newID int
		err = db.QueryRow(queryInsert, title, severity, logs).Scan(&newID)
		if err != nil {
			log.Printf("[Prometheus Integration Error] Failed to insert incident: %v", err)
			return
		}

		code := fmt.Sprintf("INC-%04d", newID)
		_, _ = db.Exec("UPDATE incidents SET incident_id = $1 WHERE id = $2", code, newID)

		// Dynamic AI Investigation
		var summary, rootCause, impact string
		var recommendations []string

		aiClient, aiErr := ai.NewAIClient(ctx)
		if aiErr == nil {
			investigator := ai.NewInvestigator(aiClient)
			aiResult, err := investigator.Investigate(ctx, title, severity, logs, "")
			if err == nil {
				summary = aiResult.Summary
				rootCause = aiResult.RootCause
				impact = aiResult.Impact
				recommendations = aiResult.Recommendations
			}
		}

		if summary == "" {
			// Fallback mock SRE investigation
			summary = fmt.Sprintf("AI Investigator detected Prometheus alert: %s", title)
			rootCause = fmt.Sprintf("Prometheus alert labels triggered threshold: %s", logs)
			impact = "Potential performance impact on active services monitored by Prometheus."
			recommendations = []string{
				fmt.Sprintf("Check service logs for job: '%s'.", labels["job"]),
				"Inspect Prometheus query graph for anomalous metric patterns.",
			}
		}

		queryInvestigation := `
			INSERT INTO investigations (incident_id, summary, root_cause, impact, recommendations, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`

		recArray := "{"
		for idx, r := range recommendations {
			if idx > 0 {
				recArray += ","
			}
			recArray += `"` + strings.ReplaceAll(r, `"`, `\"`) + `"`
		}
		recArray += "}"

		_, _ = db.Exec(queryInvestigation, newID, summary, rootCause, impact, recArray)

		if severity != "Info" {
			queryMemory := `
				INSERT INTO memory_records (title, category, content, created_at, updated_at)
				VALUES ($1, 'incident', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			`
			recStr := strings.Join(recommendations, "; ")
			memContent := fmt.Sprintf("Alert Name: %s | Severity: %s | Timestamp: %s | Recommendations: %s | Event: %s",
				title, severity, time.Now().UTC().Format(time.RFC3339), recStr, logs)
			_, _ = db.Exec(queryMemory, title, memContent)
		}

		log.Printf("[Prometheus Integration] Created new incident %s with code %s", title, code)
	}
}

type PrometheusTargetsResult struct {
	Status string `json:"status"`
	Data   struct {
		ActiveTargets []struct {
			Labels map[string]string `json:"labels"`
			Health string            `json:"health"`
		} `json:"activeTargets"`
	} `json:"data"`
}

func getTargetsParsed(ctx context.Context) (*PrometheusTargetsResult, error) {
	mu.RLock()
	urlStr := baseURL
	mu.RUnlock()

	apiURL := urlStr + "/api/v1/targets"
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("targets query returned HTTP %d", resp.StatusCode)
	}

	var payload PrometheusTargetsResult
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return &payload, nil
}

func pollInfrastructureMetricsAndSaveSnapshots(ctx context.Context, db *sql.DB) {
	startTime := time.Now()
	status := GetStatus(ctx)

	var targetsTotal, targetsHealthy, metricsCollected, alertsActive int
	var queryLatencyMs float64
	var cpuAverage, memoryAverage, networkIngressBytes, networkEgressBytes float64
	var restartCount int

	if status.Connected {
		// 1. Fetch target counts
		targetsRes, err := getTargetsParsed(ctx)
		if err == nil {
			targetsTotal = len(targetsRes.Data.ActiveTargets)
			for _, t := range targetsRes.Data.ActiveTargets {
				if t.Health == "up" {
					targetsHealthy++
				} else {
					// Trigger target down incident
					targetName := t.Labels["instance"]
					if targetName == "" {
						targetName = t.Labels["job"]
					}
					CreateOrUpdatePrometheusIncident(ctx, db, "Prometheus Target Down", "High",
						fmt.Sprintf("Prometheus scrape target '%s' is offline (health: down)", targetName), t.Labels)
				}
			}
		}

		// 2. Fetch metrics count
		metricsList, err := GetMetricsList(ctx)
		if err == nil {
			metricsCollected = len(metricsList)
		}

		// 3. Fetch active alerts count
		alertsList, err := GetAlerts(ctx)
		if err == nil {
			for _, a := range alertsList {
				if a.State == "firing" {
					alertsActive++
				}
			}
		}

		// 4. Query SRE averages
		// CPU Average
		cpuRes, err := queryInstantParsed(ctx, "avg(rate(container_cpu_usage_seconds_total{container!=\"\"}[5m])) * 100")
		if err == nil && len(cpuRes.Data.Result) > 0 {
			if len(cpuRes.Data.Result[0].Value) == 2 {
				valStr := fmt.Sprintf("%v", cpuRes.Data.Result[0].Value[1])
				cpuAverage, _ = strconv.ParseFloat(valStr, 64)
			}
		}

		// Memory Average
		memRes, err := queryInstantParsed(ctx, "avg(container_memory_usage_bytes{container!=\"\"})")
		if err == nil && len(memRes.Data.Result) > 0 {
			if len(memRes.Data.Result[0].Value) == 2 {
				valStr := fmt.Sprintf("%v", memRes.Data.Result[0].Value[1])
				memoryAverage, _ = strconv.ParseFloat(valStr, 64)
			}
		}

		// Network Ingress
		netInRes, err := queryInstantParsed(ctx, "sum(rate(container_network_receive_bytes_total[5m]))")
		if err == nil && len(netInRes.Data.Result) > 0 {
			if len(netInRes.Data.Result[0].Value) == 2 {
				valStr := fmt.Sprintf("%v", netInRes.Data.Result[0].Value[1])
				networkIngressBytes, _ = strconv.ParseFloat(valStr, 64)
			}
		}

		// Network Egress
		netOutRes, err := queryInstantParsed(ctx, "sum(rate(container_network_transmit_bytes_total[5m]))")
		if err == nil && len(netOutRes.Data.Result) > 0 {
			if len(netOutRes.Data.Result[0].Value) == 2 {
				valStr := fmt.Sprintf("%v", netOutRes.Data.Result[0].Value[1])
				networkEgressBytes, _ = strconv.ParseFloat(valStr, 64)
			}
		}

		// Restart Count
		restartRes, err := queryInstantParsed(ctx, "sum(kube_pod_container_status_restarts_total)")
		if err == nil && len(restartRes.Data.Result) > 0 {
			if len(restartRes.Data.Result[0].Value) == 2 {
				valStr := fmt.Sprintf("%v", restartRes.Data.Result[0].Value[1])
				restVal, _ := strconv.ParseFloat(valStr, 64)
				restartCount = int(restVal)
			}
		}

		// 5. Query SRE Threshold violations to trigger incidents
		// CPU spike check
		cpuSpikeRes, err := queryInstantParsed(ctx, "rate(container_cpu_usage_seconds_total{container!=\"\"}[5m]) * 100 > 90")
		if err == nil {
			for _, r := range cpuSpikeRes.Data.Result {
				podName := r.Metric["pod"]
				containerName := r.Metric["container"]
				valStr := fmt.Sprintf("%v", r.Value[1])
				val, _ := strconv.ParseFloat(valStr, 64)
				CreateOrUpdatePrometheusIncident(ctx, db, "High CPU Utilization", "High",
					fmt.Sprintf("Container '%s' in pod '%s' is consuming %.2f%% CPU (exceeds threshold 90%%)", containerName, podName, val), r.Metric)
			}
		}

		// Memory usage check
		memSpikeRes, err := queryInstantParsed(ctx, "container_memory_usage_bytes{container!=\"\"} / container_spec_memory_limit_bytes{container!=\"\"} * 100 > 90")
		if err == nil {
			for _, r := range memSpikeRes.Data.Result {
				podName := r.Metric["pod"]
				containerName := r.Metric["container"]
				valStr := fmt.Sprintf("%v", r.Value[1])
				val, _ := strconv.ParseFloat(valStr, 64)
				CreateOrUpdatePrometheusIncident(ctx, db, "High Memory Usage", "High",
					fmt.Sprintf("Container '%s' in pod '%s' is using %.2f%% Memory limit (exceeds threshold 90%%)", containerName, podName, val), r.Metric)
			}
		}

		// Restart count check
		restartSpikeRes, err := queryInstantParsed(ctx, "kube_pod_container_status_restarts_total > 10")
		if err == nil {
			for _, r := range restartSpikeRes.Data.Result {
				podName := r.Metric["pod"]
				ns := r.Metric["namespace"]
				valStr := fmt.Sprintf("%v", r.Value[1])
				val, _ := strconv.ParseFloat(valStr, 64)
				CreateOrUpdatePrometheusIncident(ctx, db, "High Pod Restart Count", "High",
					fmt.Sprintf("Pod '%s' in namespace '%s' has restarted %d times (exceeds threshold 10 restarts)", podName, ns, int(val)), r.Metric)
			}
		}

		// Node NotReady check
		nodeNotReadyRes, err := queryInstantParsed(ctx, "kube_node_status_condition{condition=\"Ready\", status=\"true\"} == 0")
		if err == nil {
			for _, r := range nodeNotReadyRes.Data.Result {
				nodeName := r.Metric["node"]
				CreateOrUpdatePrometheusIncident(ctx, db, "Node NotReady", "Critical",
					fmt.Sprintf("Kubernetes Node '%s' is in NotReady state", nodeName), r.Metric)
			}
		}

		// Failed deployment check
		failedDeployRes, err := queryInstantParsed(ctx, "kube_deployment_status_replicas_unavailable > 0")
		if err == nil {
			for _, r := range failedDeployRes.Data.Result {
				deployName := r.Metric["deployment"]
				ns := r.Metric["namespace"]
				valStr := fmt.Sprintf("%v", r.Value[1])
				val, _ := strconv.ParseFloat(valStr, 64)
				CreateOrUpdatePrometheusIncident(ctx, db, "Failed Deployment", "Critical",
					fmt.Sprintf("Deployment '%s' in namespace '%s' has %d unavailable replicas", deployName, ns, int(val)), r.Metric)
			}
		}
	} else {
		// Graceful degradation: Prometheus is offline. Read direct metrics from K8s and Docker if available,
		// and save a degraded snapshot.
		log.Printf("[Prometheus Poller] Degrading gracefully. Server offline. Raising status incident.")
		CreateOrUpdatePrometheusIncident(ctx, db, "Prometheus Target Down", "High",
			"Prometheus server is offline at http://localhost:9090. Metric scraping is suspended.", map[string]string{"job": "prometheus"})

		// Query K8s directly if connected
		k8sStatus := kubernetes.GetK8sStatus(ctx)
		if k8sStatus.Connected {
			pods, err := kubernetes.GetK8sPods(ctx)
			if err == nil {
				for _, p := range pods {
					if p.RestartCount > 10 {
						CreateOrUpdatePrometheusIncident(ctx, db, "High Pod Restart Count", "High",
							fmt.Sprintf("Pod '%s' in namespace '%s' has restarted %d times (direct K8s audit)", p.Name, p.Namespace, p.RestartCount),
							map[string]string{"pod": p.Name, "namespace": p.Namespace})
					}
				}
			}

			nodes, err := kubernetes.GetK8sNodes(ctx)
			if err == nil {
				for _, n := range nodes {
					if n.Status != "Ready" {
						CreateOrUpdatePrometheusIncident(ctx, db, "Node NotReady", "Critical",
							fmt.Sprintf("Kubernetes Node '%s' status is '%s' (direct K8s audit)", n.Name, n.Status),
							map[string]string{"node": n.Name})
					}
				}
			}

			deploys, err := kubernetes.GetK8sDeployments(ctx)
			if err == nil {
				for _, d := range deploys {
					if d.ReadyReplicas < d.DesiredReplicas {
						CreateOrUpdatePrometheusIncident(ctx, db, "Failed Deployment", "Critical",
							fmt.Sprintf("Deployment '%s' in namespace '%s' is degraded: %d/%d ready replicas (direct K8s audit)",
								d.Name, d.Namespace, d.ReadyReplicas, d.DesiredReplicas),
							map[string]string{"deployment": d.Name, "namespace": d.Namespace})
					}
				}
			}
		}
	}

	queryLatencyMs = float64(time.Since(startTime).Milliseconds())

	// Persist snapshot to database
	queryInsert := `
		INSERT INTO prometheus_snapshots (
			connected, targets_total, targets_healthy, metrics_collected, alerts_active,
			query_latency_ms, cpu_average, memory_average, network_ingress_bytes, network_egress_bytes, restart_count
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, dbErr := db.Exec(queryInsert, status.Connected, targetsTotal, targetsHealthy, metricsCollected, alertsActive,
		queryLatencyMs, cpuAverage, memoryAverage, networkIngressBytes, networkEgressBytes, restartCount)
	if dbErr != nil {
		log.Printf("[Prometheus Poller Error] Failed to persist snapshot: %v", dbErr)
	}
	triggerUpdate()
}

type PrometheusQueryResult struct {
	Status string `json:"status"`
	Data   struct {
		ResultType string `json:"resultType"`
		Result     []struct {
			Metric map[string]string `json:"metric"`
			Value  []interface{}     `json:"value"`
		} `json:"result"`
	} `json:"data"`
}

func queryInstantParsed(ctx context.Context, query string) (*PrometheusQueryResult, error) {
	mu.RLock()
	urlStr := baseURL
	mu.RUnlock()

	apiURL := fmt.Sprintf("%s/api/v1/query?query=%s", urlStr, url.QueryEscape(query))
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("instant query returned HTTP %d", resp.StatusCode)
	}

	var payload PrometheusQueryResult
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return &payload, nil
}
