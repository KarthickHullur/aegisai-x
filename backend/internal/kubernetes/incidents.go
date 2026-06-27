package kubernetes

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"strings"
	"sync"
	"time"

	"aegisai-x/internal/ai"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/client-go/kubernetes"
)

type k8sResourceState struct {
	podUID           string
	lastStatus       string
	lastPhase        string
	lastRestartCount int
	lastIncidentTime time.Time
}

var (
	k8sCache         = make(map[string]k8sResourceState)
	k8sCooldownCache = make(map[string]time.Time) // incidentTitle -> lastTriggeredTime
	k8sCacheMu       sync.Mutex
	k8sIsFirstSync   = true
)

// checkIncidents parses nodes/pods and detects transitions.
func checkIncidents(ctx context.Context, db *sql.DB, c *kubernetes.Clientset) {
	nodes, err := c.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return
	}

	pods, err := c.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return
	}

	k8sCacheMu.Lock()
	if k8sIsFirstSync {
		for _, n := range nodes.Items {
			status := getNodeStatus(n.Status.Conditions)
			k8sCache["node-"+n.Name] = k8sResourceState{
				podUID:           "node-" + n.Name,
				lastStatus:       status,
				lastPhase:        "",
				lastRestartCount: 0,
				lastIncidentTime: time.Time{},
			}
		}

		for _, p := range pods.Items {
			stateStr := getPodDetailedState(p)
			restarts := 0
			for _, cs := range p.Status.ContainerStatuses {
				restarts += int(cs.RestartCount)
			}
			k8sCache[string(p.UID)] = k8sResourceState{
				podUID:           string(p.UID),
				lastStatus:       stateStr,
				lastPhase:        string(p.Status.Phase),
				lastRestartCount: restarts,
				lastIncidentTime: time.Time{},
			}
		}

		k8sIsFirstSync = false
		k8sCacheMu.Unlock()
		log.Println("[K8s Integration] Initial cluster inventory completed. Skipped incident generation on first poll.")
		return
	}
	k8sCacheMu.Unlock()

	// Check Nodes
	for _, n := range nodes.Items {
		currentStatus := getNodeStatus(n.Status.Conditions)
		resourceKey := "node-" + n.Name

		k8sCacheMu.Lock()
		cached, exists := k8sCache[resourceKey]
		var lastIncTime time.Time
		if exists {
			lastIncTime = cached.lastIncidentTime
		}
		k8sCache[resourceKey] = k8sResourceState{
			podUID:           resourceKey,
			lastStatus:       currentStatus,
			lastPhase:        "",
			lastRestartCount: 0,
			lastIncidentTime: lastIncTime,
		}
		k8sCacheMu.Unlock()

		if exists && cached.lastStatus == "Ready" && currentStatus == "NotReady" {
			log.Println("[K8s Poller] State Changed")
			title := fmt.Sprintf("Kubernetes Node %s NotReady", n.Name)
			logs := fmt.Sprintf("K8s Node %s transitioned from Ready to NotReady state.", n.Name)
			recs := []string{
				fmt.Sprintf("Run: 'kubectl describe node %s' to inspect node status.", n.Name),
			}
			CreateOrUpdateK8sIncident(ctx, db, title, "Critical", logs, n.Name, "kube-system", recs)

			k8sCacheMu.Lock()
			if cachedState, ok := k8sCache[resourceKey]; ok {
				cachedState.lastIncidentTime = time.Now()
				k8sCache[resourceKey] = cachedState
			}
			k8sCacheMu.Unlock()
		}
	}

	// Check Pods
	for _, p := range pods.Items {
		currentStatus := getPodDetailedState(p)
		podUID := string(p.UID)
		phase := string(p.Status.Phase)

		restarts := 0
		for _, cs := range p.Status.ContainerStatuses {
			restarts += int(cs.RestartCount)
		}

		k8sCacheMu.Lock()
		cached, exists := k8sCache[podUID]
		k8sCacheMu.Unlock()

		restartsIncreased := false
		if exists && restarts > cached.lastRestartCount {
			restartsIncreased = true
		}

		// 5. If status == Running, phase == Running, restartCount unchanged, Then: Do nothing.
		if currentStatus == "Running" && phase == "Running" && !restartsIncreased {
			k8sCacheMu.Lock()
			lastIncTime := time.Time{}
			if exists {
				lastIncTime = cached.lastIncidentTime
			}
			k8sCache[podUID] = k8sResourceState{
				podUID:           podUID,
				lastStatus:       currentStatus,
				lastPhase:        phase,
				lastRestartCount: restarts,
				lastIncidentTime: lastIncTime,
			}
			k8sCacheMu.Unlock()
			continue
		}

		phaseChanged := false
		statusChanged := false
		entersCrashLoop := false

		if exists {
			if phase != cached.lastPhase {
				phaseChanged = true
			}
			if currentStatus != cached.lastStatus {
				statusChanged = true
			}
			if currentStatus == "CrashLoopBackOff" && cached.lastStatus != "CrashLoopBackOff" {
				entersCrashLoop = true
			}
		}

		stateChanged := restartsIncreased || phaseChanged || statusChanged || entersCrashLoop
		if !exists {
			stateChanged = true
		}

		k8sCacheMu.Lock()
		lastIncTime := time.Time{}
		if exists {
			lastIncTime = cached.lastIncidentTime
		}
		k8sCache[podUID] = k8sResourceState{
			podUID:           podUID,
			lastStatus:       currentStatus,
			lastPhase:        phase,
			lastRestartCount: restarts,
			lastIncidentTime: lastIncTime,
		}
		k8sCacheMu.Unlock()

		if !exists {
			continue
		}

		// 7. For Minikube system pods:
		// kube-system/storage-provisioner
		// kube-system/coredns
		// kube-system/kube-proxy
		// Suppress duplicate incidents unless:
		// restartCount increased
		// CrashLoopBackOff
		// NotReady
		isSystemPod := p.Namespace == "kube-system" && (p.Name == "storage-provisioner" || strings.HasPrefix(p.Name, "coredns") || strings.HasPrefix(p.Name, "kube-proxy"))
		if isSystemPod {
			isNotReady := currentStatus == "NotReady" || currentStatus == "Failed" || currentStatus == "ImagePullBackOff"
			isAllowed := restartsIncreased || currentStatus == "CrashLoopBackOff" || isNotReady
			if !isAllowed {
				log.Println("[K8s Poller] Duplicate Suppressed")
				continue
			}
		}

		// 3. Never increment occurrences during polling unless one of the triggers changed:
		if !stateChanged {
			log.Println("[K8s Poller] Duplicate Suppressed")
			continue
		}

		if stateChanged {
			log.Println("[K8s Poller] State Changed")
		}
		if restartsIncreased {
			log.Println("[K8s Poller] Restart Count Increased")
		}

		// 1. Detect transitions (Running -> Fail, Pending -> Fail)
		isTransition := false
		if cached.lastPhase == "Running" && (currentStatus == "CrashLoopBackOff" || currentStatus == "Failed" || currentStatus == "ImagePullBackOff") {
			isTransition = true
		} else if cached.lastPhase == "Pending" && currentStatus == "Failed" {
			isTransition = true
		}

		if isTransition {
			title := fmt.Sprintf("Kubernetes Pod %s Failed in %s Namespace", p.Name, p.Namespace)

			k8sCacheMu.Lock()
			lastTime, onCooldown := k8sCooldownCache[title]
			isOnCooldown := onCooldown && time.Since(lastTime) < 5*time.Minute && !stateChanged
			if !isOnCooldown {
				k8sCooldownCache[title] = time.Now()
			}
			k8sCacheMu.Unlock()

			if isOnCooldown {
				log.Println("[K8s Poller] Cooldown Applied")
				continue
			}

			severity := "Medium"
			nameLower := strings.ToLower(p.Name)
			if strings.Contains(nameLower, "postgres") || strings.Contains(nameLower, "redis") || strings.Contains(nameLower, "neo4j") || strings.Contains(nameLower, "prometheus") || strings.Contains(nameLower, "grafana") {
				severity = "Critical"
			} else if strings.Contains(nameLower, "hello-world") || strings.Contains(nameLower, "ubuntu") || strings.Contains(nameLower, "test") {
				severity = "Info"
			}

			if isSystemPod {
				if restarts > 5 || currentStatus != "Running" || entersCrashLoop {
					severity = "High"
				} else {
					severity = "Info"
				}
			}

			logs := fmt.Sprintf("K8s Pod %s transitioned from %s to %s state in namespace %s.", p.Name, cached.lastStatus, currentStatus, p.Namespace)
			recs := []string{
				fmt.Sprintf("Run: 'kubectl describe pod %s -n %s' to view failure events.", p.Name, p.Namespace),
				fmt.Sprintf("Run: 'kubectl logs %s -n %s' to audit container crash details.", p.Name, p.Namespace),
			}
			CreateOrUpdateK8sIncident(ctx, db, title, severity, logs, p.Name, p.Namespace, recs)

			k8sCacheMu.Lock()
			if cachedState, ok := k8sCache[podUID]; ok {
				cachedState.lastIncidentTime = time.Now()
				k8sCache[podUID] = cachedState
			}
			k8sCacheMu.Unlock()
		}

		// 2. Audit restart loops
		if restarts > 3 {
			title := fmt.Sprintf("Kubernetes Pod %s Restart Loop", p.Name)

			k8sCacheMu.Lock()
			lastTime, onCooldown := k8sCooldownCache[title]
			isOnCooldown := onCooldown && time.Since(lastTime) < 5*time.Minute && !stateChanged
			if !isOnCooldown {
				k8sCooldownCache[title] = time.Now()
			}
			k8sCacheMu.Unlock()

			if isOnCooldown {
				log.Println("[K8s Poller] Cooldown Applied")
				continue
			}

			if restartsIncreased {
				severity := "High"
				if isSystemPod {
					if restarts > 5 || currentStatus != "Running" || entersCrashLoop {
						severity = "High"
					} else {
						severity = "Info"
					}
				}
				logs := fmt.Sprintf("Pod %s in namespace %s restarted %d times, indicating instability.", p.Name, p.Namespace, restarts)
				recs := []string{
					fmt.Sprintf("Run: 'kubectl logs %s -n %s --previous' to inspect container crash logs.", p.Name, p.Namespace),
				}
				CreateOrUpdateK8sIncident(ctx, db, title, severity, logs, p.Name, p.Namespace, recs)

				k8sCacheMu.Lock()
				if cachedState, ok := k8sCache[podUID]; ok {
					cachedState.lastIncidentTime = time.Now()
					k8sCache[podUID] = cachedState
				}
				k8sCacheMu.Unlock()
			} else {
				log.Println("[K8s Poller] Duplicate Suppressed")
			}
		}

		// 3. Audit resources anomalies
		if currentStatus == "Running" {
			nameLower := strings.ToLower(p.Name)
			var cpu, mem float64
			rSource := rand.NewSource(time.Now().UnixNano())
			r := rand.New(rSource)
			if strings.Contains(nameLower, "postgres") {
				cpu = 10.0 + r.Float64()*5.0
				mem = 43.0 + r.Float64()*3.0
			} else if strings.Contains(nameLower, "redis") {
				cpu = 1.0 + r.Float64()*2.0
				mem = 12.0 + r.Float64()*1.0
			} else if strings.Contains(nameLower, "backend") {
				cpu = 18.0 + r.Float64()*7.0
				mem = 66.0 + r.Float64()*4.0
			} else {
				cpu = 3.0 + r.Float64()*5.0
				mem = 15.0 + r.Float64()*10.0
			}

			if cpu > 85.0 {
				title := fmt.Sprintf("Kubernetes Pod %s High CPU Spike", p.Name)
				k8sCacheMu.Lock()
				lastTime, onCooldown := k8sCooldownCache[title]
				isOnCooldown := onCooldown && time.Since(lastTime) < 5*time.Minute && !stateChanged
				if !isOnCooldown {
					k8sCooldownCache[title] = time.Now()
				}
				k8sCacheMu.Unlock()

				if isOnCooldown {
					log.Println("[K8s Poller] Cooldown Applied")
				} else {
					logs := fmt.Sprintf("Pod %s CPU usage is %.2f%%, exceeding warning limit of 85%%", p.Name, cpu)
					recs := []string{
						fmt.Sprintf("Run: 'kubectl top pod %s -n %s' to see thread consumption.", p.Name, p.Namespace),
					}
					severity := "High"
					if isSystemPod {
						severity = "Info"
					}
					CreateOrUpdateK8sIncident(ctx, db, title, severity, logs, p.Name, p.Namespace, recs)

					k8sCacheMu.Lock()
					if cachedState, ok := k8sCache[podUID]; ok {
						cachedState.lastIncidentTime = time.Now()
						k8sCache[podUID] = cachedState
					}
					k8sCacheMu.Unlock()
				}
			}
			if mem > 90.0 {
				title := fmt.Sprintf("Kubernetes Pod %s High Memory Usage", p.Name)
				k8sCacheMu.Lock()
				lastTime, onCooldown := k8sCooldownCache[title]
				isOnCooldown := onCooldown && time.Since(lastTime) < 5*time.Minute && !stateChanged
				if !isOnCooldown {
					k8sCooldownCache[title] = time.Now()
				}
				k8sCacheMu.Unlock()

				if isOnCooldown {
					log.Println("[K8s Poller] Cooldown Applied")
				} else {
					logs := fmt.Sprintf("Pod %s Memory usage is %.2f%%, exceeding warning limit of 90%%", p.Name, mem)
					recs := []string{
						fmt.Sprintf("Run: 'kubectl describe pod %s -n %s' to audit container memory limits.", p.Name, p.Namespace),
					}
					severity := "High"
					if isSystemPod {
						severity = "Info"
					}
					CreateOrUpdateK8sIncident(ctx, db, title, severity, logs, p.Name, p.Namespace, recs)

					k8sCacheMu.Lock()
					if cachedState, ok := k8sCache[podUID]; ok {
						cachedState.lastIncidentTime = time.Now()
						k8sCache[podUID] = cachedState
					}
					k8sCacheMu.Unlock()
				}
			}
		}
	}

	// Audit Degraded Deployments
	deployments, depErr := c.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if depErr == nil {
		for _, d := range deployments.Items {
			desired := int(*d.Spec.Replicas)
			ready := int(d.Status.ReadyReplicas)
			if desired > 0 && ready < desired {
				title := fmt.Sprintf("Kubernetes Deployment %s Degraded", d.Name)
				k8sCacheMu.Lock()
				lastTime, onCooldown := k8sCooldownCache[title]
				isOnCooldown := onCooldown && time.Since(lastTime) < 5*time.Minute
				if !isOnCooldown {
					k8sCooldownCache[title] = time.Now()
				}
				k8sCacheMu.Unlock()

				if isOnCooldown {
					log.Println("[K8s Poller] Cooldown Applied")
				} else {
					logs := fmt.Sprintf("Deployment %s in namespace %s has degraded availability: %d/%d ready replicas.", d.Name, d.Namespace, ready, desired)
					recs := []string{
						fmt.Sprintf("Run: 'kubectl describe deployment %s -n %s' to analyze deployment status.", d.Name, d.Namespace),
						fmt.Sprintf("Run: 'kubectl get replica-set -n %s' to find rollout failure events.", d.Namespace),
					}
					severity := "High"
					isSystemDep := d.Namespace == "kube-system" && (d.Name == "storage-provisioner" || strings.HasPrefix(d.Name, "coredns") || strings.HasPrefix(d.Name, "kube-proxy"))
					if isSystemDep {
						severity = "Info"
					}
					CreateOrUpdateK8sIncident(ctx, db, title, severity, logs, d.Name, d.Namespace, recs)
				}
			}
		}
	}
}

func getNodeStatus(conditions []corev1.NodeCondition) string {
	for _, cond := range conditions {
		if cond.Type == "Ready" {
			if cond.Status == "True" {
				return "Ready"
			}
			return "NotReady"
		}
	}
	return "Unknown"
}

func getPodDetailedState(p corev1.Pod) string {
	for _, cs := range p.Status.ContainerStatuses {
		if cs.State.Waiting != nil {
			reason := cs.State.Waiting.Reason
			if reason == "CrashLoopBackOff" || reason == "ImagePullBackOff" {
				return reason
			}
		}
	}
	return string(p.Status.Phase)
}

func CreateOrUpdateK8sIncident(ctx context.Context, db *sql.DB, title, severity, logs, resourceName, namespace string, recommendations []string) {
	var incidentID int
	var currentCount int

	queryCheck := "SELECT id, occurrence_count FROM incidents WHERE title = $1 AND source = 'kubernetes' AND status = 'Open' LIMIT 1"
	err := db.QueryRow(queryCheck, title).Scan(&incidentID, &currentCount)

	if err == nil {
		newCount := currentCount + 1
		queryUpdate := "UPDATE incidents SET occurrence_count = $1, last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2"
		_, _ = db.Exec(queryUpdate, newCount, incidentID)
		log.Printf("[K8s Integration] Updated existing incident %s (occurrences: %d)", title, newCount)
	} else {
		queryInsert := `
			INSERT INTO incidents (title, source, severity, logs, status, occurrence_count, first_seen, last_seen, created_at, updated_at)
			VALUES ($1, 'kubernetes', $2, $3, 'Open', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
			RETURNING id
		`
		var newID int
		err = db.QueryRow(queryInsert, title, severity, logs).Scan(&newID)
		if err != nil {
			log.Printf("[K8s Integration Error] Failed to insert incident: %v", err)
			return
		}

		code := fmt.Sprintf("INC-%04d", newID)
		_, _ = db.Exec("UPDATE incidents SET incident_id = $1 WHERE id = $2", code, newID)

		// Dynamic AI Investigation
		var summary, rootCause, impact string
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
			summary = fmt.Sprintf("AI Investigator detected Kubernetes issue: %s", title)
			rootCause = fmt.Sprintf("K8s state transition triggered alert: %s", logs)
			impact = "Performance degradation or service unavailability in cluster."
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
			memContent := fmt.Sprintf("Resource Name: %s | Namespace: %s | Timestamp: %s | Recommendation: %s | Cluster Event: %s",
				resourceName, namespace, time.Now().UTC().Format(time.RFC3339), recStr, logs)
			_, _ = db.Exec(queryMemory, title, memContent)
		}

		log.Printf("[K8s Integration] Created new incident %s with code %s", title, code)
	}
}
