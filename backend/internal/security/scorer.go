package security

import (
	"context"
	"database/sql"
	"log"
	"strings"
	"time"

	"aegisai-x/internal/docker"
	"aegisai-x/internal/kubernetes"
	"aegisai-x/internal/prometheus"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// helper to add capped penalties proportionally
func addPenalty(raw *float64, actual *float64, rawVal float64, actualVal float64, capVal float64) {
	if rawVal > capVal {
		ratio := 1.0
		if rawVal > 0 {
			ratio = actualVal / rawVal
		}
		*raw += capVal
		*actual += capVal * ratio
	} else {
		*raw += rawVal
		*actual += actualVal
	}
}

// CalculateScore calculates the real infrastructure security score.
func CalculateScore(ctx context.Context, db *sql.DB) (SecurityScoreResponse, error) {
	var breakdown []SecurityBreakdownItem
	scoreVal := 100.0

	// 1. Audit Docker connection status and info
	dockerStatus := docker.GetDockerStatus(ctx)
	dockerConnected := dockerStatus.Connected
	var dockerPrivileged int
	var dockerRoot int
	var dockerLatest int
	var dockerExposedDb int
	var dockerExposedPorts int

	// Detect if Docker Desktop context is present
	dockerDesktopDetected := false
	if dockerConnected && strings.Contains(strings.ToLower(dockerStatus.EngineVersion), "desktop") {
		dockerDesktopDetected = true
	}
	// Local host Prometheus detection
	localhostPrometheus := true // default to true since base URL is localhost:9090

	// 2. Audit Kubernetes connection status
	k8sStatus := kubernetes.GetK8sStatus(ctx)
	k8sConnected := k8sStatus.Connected
	var k8sHostPath int
	var k8sCrashLoop int
	var k8sImagePull int
	var k8sPrivileged int
	var k8sRoot int
	var k8sLatest int
	var k8sCpuLimits int
	var k8sMemLimits int

	minikubeDetected := false
	k8sClient := kubernetes.GetClientset()
	if k8sClient != nil && k8sConnected {
		// Detect Minikube via node list
		nodes, err := k8sClient.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, node := range nodes.Items {
				if strings.Contains(strings.ToLower(node.Name), "minikube") {
					minikubeDetected = true
					break
				}
			}
		}
	}

	// 3. Audit Prometheus
	promStatus := prometheus.GetStatus(ctx)
	promConnected := promStatus.Connected

	// 4. Environment Detection
	env := "production"
	reason := "Standard production security constraints applied."
	if minikubeDetected || dockerDesktopDetected || localhostPrometheus {
		env = "development"
		reason = "Local Minikube and Docker Desktop environments intentionally use privileged containers and development configurations."
	}

	// 5. Raw Docker Audit and penalty calculation (running containers only for score)
	var rawDockerPenalty float64
	var actualDockerPenalty float64

	if dockerConnected {
		cli := docker.GetClient()
		if cli != nil {
			containers, err := docker.GetDockerContainers(ctx)
			if err == nil {
				for _, cnt := range containers {
					inspect, err := cli.ContainerInspect(ctx, cnt.ID)
					if err != nil {
						continue
					}

					// Raw check values (for count and vulnerability definitions)
					isPrivileged := inspect.HostConfig.Privileged
					isRoot := inspect.Config.User == "" || inspect.Config.User == "0" || inspect.Config.User == "root"
					isLatest := strings.HasSuffix(cnt.Image, ":latest") || !strings.Contains(cnt.Image, ":")

					isExposedDb := false
					isDB := strings.Contains(strings.ToLower(cnt.Name), "postgres") || strings.Contains(strings.ToLower(cnt.Name), "mysql") || strings.Contains(strings.ToLower(cnt.Name), "redis") || strings.Contains(strings.ToLower(cnt.Name), "mongo")
					if isDB {
						for _, p := range inspect.NetworkSettings.Ports {
							for _, binding := range p {
								if binding.HostIP == "0.0.0.0" || binding.HostIP == "::" {
									isExposedDb = true
									break
								}
							}
						}
					}

					isExposedPorts := false
					for _, p := range inspect.NetworkSettings.Ports {
						for _, binding := range p {
							if binding.HostIP == "0.0.0.0" || binding.HostIP == "::" {
								if binding.HostPort == "22" || binding.HostPort == "2375" || binding.HostPort == "2376" {
									isExposedPorts = true
								}
							}
						}
					}

					// Update global counts for findings (all containers, running or stopped)
					if isPrivileged {
						dockerPrivileged++
					}
					if isRoot {
						dockerRoot++
					}
					if isLatest {
						dockerLatest++
					}
					if isExposedDb {
						dockerExposedDb++
					}
					if isExposedPorts {
						dockerExposedPorts++
					}

					// Penalize only running containers
					if inspect.State.Running {
						m := 1.0
						if strings.Contains(strings.ToLower(cnt.Name), "minikube") || strings.Contains(strings.ToLower(cnt.Image), "minikube") {
							m = 0.25
						} else if env == "development" {
							m = 0.50
						}

						if isPrivileged {
							rawDockerPenalty += 10.0
							actualDockerPenalty += 10.0 * m
						}
						if isExposedDb {
							rawDockerPenalty += 5.0
							actualDockerPenalty += 5.0 * m
						}
						if isRoot {
							rawDockerPenalty += 1.0
							actualDockerPenalty += 1.0 * m
						}
						if isLatest {
							rawDockerPenalty += 0.5
							actualDockerPenalty += 0.5 * m
						}
						if isExposedPorts {
							rawDockerPenalty += 5.0
							actualDockerPenalty += 5.0 * m
						}
					}
				}
			}
		}
	}

	// 6. Kubernetes Audit and penalty calculation
	var rawK8sPenalty float64
	var actualK8sPenalty float64

	if k8sClient != nil && k8sConnected {
		pods, err := k8sClient.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
		if err == nil {
			for _, p := range pods.Items {
				// Pod multiplier
				m := 1.0
				if p.Namespace == "kube-system" {
					m = 0.25
				} else if strings.Contains(strings.ToLower(p.Name), "minikube") {
					m = 0.25
				} else if env == "development" {
					m = 0.50
				}

				// Check HostPath volume mounts
				hasHostPath := false
				for _, v := range p.Spec.Volumes {
					if v.HostPath != nil {
						hasHostPath = true
						break
					}
				}
				if hasHostPath {
					k8sHostPath++
					rawK8sPenalty += 5.0
					actualK8sPenalty += 5.0 * m
				}

				// Check CrashLoopBackOff and ImagePullBackOff status
				isCrashLoop := false
				isImagePull := false
				for _, cs := range p.Status.ContainerStatuses {
					if cs.State.Waiting != nil {
						r := cs.State.Waiting.Reason
						if r == "CrashLoopBackOff" {
							isCrashLoop = true
						} else if r == "ImagePullBackOff" || r == "ErrImagePull" {
							isImagePull = true
						}
					}
				}
				if isCrashLoop {
					k8sCrashLoop++
					rawK8sPenalty += 5.0
					actualK8sPenalty += 5.0 * m
				}
				if isImagePull {
					k8sImagePull++
					rawK8sPenalty += 5.0
					actualK8sPenalty += 5.0 * m
				}

				// Check container security context
				for _, container := range p.Spec.Containers {
					isPrivileged := false
					if container.SecurityContext != nil && container.SecurityContext.Privileged != nil {
						isPrivileged = *container.SecurityContext.Privileged
					}
					if isPrivileged {
						k8sPrivileged++
						rawK8sPenalty += 10.0
						actualK8sPenalty += 10.0 * m
					}

					runAsRoot := false
					runAsNonRootSet := false
					if container.SecurityContext != nil && container.SecurityContext.RunAsNonRoot != nil {
						runAsRoot = !*container.SecurityContext.RunAsNonRoot
						runAsNonRootSet = true
					} else if p.Spec.SecurityContext != nil && p.Spec.SecurityContext.RunAsNonRoot != nil {
						runAsRoot = !*p.Spec.SecurityContext.RunAsNonRoot
						runAsNonRootSet = true
					}
					if container.SecurityContext != nil && container.SecurityContext.RunAsUser != nil {
						if *container.SecurityContext.RunAsUser == 0 {
							runAsRoot = true
						}
					} else if p.Spec.SecurityContext != nil && p.Spec.SecurityContext.RunAsUser != nil {
						if *p.Spec.SecurityContext.RunAsUser == 0 {
							runAsRoot = true
						}
					} else if !runAsNonRootSet {
						runAsRoot = true
					}
					if runAsRoot {
						k8sRoot++
						rawK8sPenalty += 1.0
						actualK8sPenalty += 1.0 * m
					}

					if strings.HasSuffix(container.Image, ":latest") || !strings.Contains(container.Image, ":") {
						k8sLatest++
						rawK8sPenalty += 0.5
						actualK8sPenalty += 0.5 * m
					}

					limits := container.Resources.Limits
					if limits == nil || limits.Cpu().IsZero() {
						k8sCpuLimits++
						rawK8sPenalty += 1.0
						actualK8sPenalty += 1.0 * m
					}
					if limits == nil || limits.Memory().IsZero() {
						k8sMemLimits++
						rawK8sPenalty += 1.0
						actualK8sPenalty += 1.0 * m
					}
				}
			}
		}
	}

	// 7. Connection checks and Base score
	dockerPoints := 20.0
	dockerStatusStr := "healthy"
	if !dockerConnected {
		scoreVal -= 20.0
		dockerPoints = 0.0
		dockerStatusStr = "critical"
	}
	breakdown = append(breakdown, SecurityBreakdownItem{Name: "Docker Connected", Status: dockerStatusStr, Points: dockerPoints})

	k8sPoints := 20.0
	k8sStatusStr := "healthy"
	if !k8sConnected {
		scoreVal -= 20.0
		k8sPoints = 0.0
		k8sStatusStr = "critical"
	}
	breakdown = append(breakdown, SecurityBreakdownItem{Name: "Kubernetes Connected", Status: k8sStatusStr, Points: k8sPoints})

	promPoints := 20.0
	promStatusStr := "healthy"
	if !promConnected {
		scoreVal -= 20.0
		promPoints = 0.0
		promStatusStr = "critical"
	}
	breakdown = append(breakdown, SecurityBreakdownItem{Name: "Prometheus Connected", Status: promStatusStr, Points: promPoints})

	// Add Base Posture Score
	breakdown = append(breakdown, SecurityBreakdownItem{Name: "Base Posture Score", Status: "healthy", Points: 40.0})

	// Deduct actual Docker and Kubernetes penalties
	scoreVal -= actualDockerPenalty
	scoreVal -= actualK8sPenalty

	// Development Adjustments calculation
	devAdjustments := (rawDockerPenalty - actualDockerPenalty) + (rawK8sPenalty - actualK8sPenalty)

	// Populate findings and adjustments in breakdown
	if rawDockerPenalty > 0 {
		breakdown = append(breakdown, SecurityBreakdownItem{
			Name:   "Docker Findings",
			Status: "warning",
			Points: -rawDockerPenalty,
		})
	}
	if rawK8sPenalty > 0 {
		breakdown = append(breakdown, SecurityBreakdownItem{
			Name:   "Kubernetes Findings",
			Status: "warning",
			Points: -rawK8sPenalty,
		})
	}
	if devAdjustments > 0 {
		breakdown = append(breakdown, SecurityBreakdownItem{
			Name:   "Development Adjustments",
			Status: "healthy",
			Points: devAdjustments,
		})
	}

	// Final capping
	scoreInt := int(scoreVal)
	if scoreInt < 0 {
		scoreInt = 0
	}
	if scoreInt > 100 {
		scoreInt = 100
	}

	// Grade Mapping
	grade := "Critical"
	if scoreInt >= 90 {
		grade = "Excellent"
	} else if scoreInt >= 75 {
		grade = "Good"
	} else if scoreInt >= 50 {
		grade = "Warning"
	}

	// Logging
	if env == "development" {
		log.Println("[Security] Environment detected: development")
		log.Println("[Security] Applying development scoring adjustments")
	}
	log.Printf("[Security] Posture score recalculated: %d/100 (%s)", scoreInt, grade)

	// Raw vulnerability counts fallback (if docker and k8s both disconnected)
	var criticalCount, highCount, mediumCount, lowCount int
	if dockerConnected || k8sConnected {
		criticalCount = dockerPrivileged + k8sPrivileged
		highCount = dockerExposedDb + k8sHostPath + k8sCrashLoop + k8sImagePull
		mediumCount = dockerRoot + k8sRoot + k8sCpuLimits + k8sMemLimits
		lowCount = dockerLatest + k8sLatest
	} else {
		criticalCount = 1
		highCount = 1
		mediumCount = 1
		lowCount = 0
	}

	return SecurityScoreResponse{
		Score:                 scoreInt,
		Grade:                 grade,
		Critical:              criticalCount,
		High:                  highCount,
		Medium:                mediumCount,
		Low:                   lowCount,
		Environment:           env,
		Reason:                reason,
		DockerFindingsPenalty: rawDockerPenalty,
		K8sFindingsPenalty:    rawK8sPenalty,
		DevAdjustments:        devAdjustments,
		Breakdown:             breakdown,
		LastUpdated:           time.Now(),
	}, nil
}
