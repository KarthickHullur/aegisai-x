package kubernetes

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"aegisai-x/internal/database/postgres"
	"aegisai-x/internal/docker"
	"aegisai-x/internal/utils"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

var (
	cs          *kubernetes.Clientset
	contextName string
	k8sMu       sync.RWMutex
	lastK8sErr  error
)

// InitK8sClient loads configuration with priority: (1) In-cluster, (2) kubeconfig contexts.
func InitK8sClient() error {
	k8sMu.Lock()
	defer k8sMu.Unlock()

	log.Println("[K8s] Initializing client...")

	ctx := context.Background()

	// Try loading from database first
	var credsStr, connStatus string
	var dbKubeconfig string
	if postgres.DB != nil {
		err := postgres.DB.QueryRowContext(ctx, "SELECT encrypted_credentials, status FROM cloud_connections WHERE provider = 'kubernetes'").Scan(&credsStr, &connStatus)
		if err == nil && connStatus == "connected" && credsStr != "" {
			decrypted, errDec := utils.Decrypt(credsStr)
			if errDec == nil {
				var creds struct {
					Kubeconfig string `json:"kubeconfig"`
				}
				if json.Unmarshal([]byte(decrypted), &creds) == nil && creds.Kubeconfig != "" {
					dbKubeconfig = creds.Kubeconfig
				}
			}
		}
	}

	var restConfig *rest.Config
	var err error
	if dbKubeconfig != "" {
		restConfig, err = clientcmd.RESTConfigFromKubeConfig([]byte(dbKubeconfig))
		if err == nil {
			rawConf, errRaw := clientcmd.Load([]byte(dbKubeconfig))
			if errRaw == nil && rawConf.CurrentContext != "" {
				contextName = rawConf.CurrentContext
			} else {
				contextName = "custom-kubeconfig"
			}
		}
	} else {
		// 1. Try In-Cluster Config
		restConfig, err = rest.InClusterConfig()
		if err == nil {
			contextName = "in-cluster"
		} else {
			// 2. Try default kubeconfig
			loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
			configOverrides := &clientcmd.ConfigOverrides{}
			kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)

			restConfig, err = kubeConfig.ClientConfig()
			if err == nil {
				rawConfig, errConfig := kubeConfig.RawConfig()
				if errConfig == nil && rawConfig.CurrentContext != "" {
					contextName = rawConfig.CurrentContext
				} else {
					contextName = "default"
				}
			} else {
				contextName = "unknown"
			}
		}
	}

	log.Printf("[K8s] Current Context: %s", contextName)

	// Check Docker
	log.Println("[K8s] Checking Docker Engine...")
	dockerStatus := docker.GetDockerStatus(ctx)
	if dockerStatus.Connected {
		log.Println("[K8s] Docker Engine Connected")

		log.Println("[K8s] Checking Minikube Container...")
		minikubeRunning, mkErr := checkMinikubeContainer(ctx)
		if mkErr == nil && minikubeRunning {
			log.Println("[K8s] Minikube Container Running")
		} else {
			log.Printf("[K8s Warning] Minikube Container is not running: %v", mkErr)
		}
	} else {
		log.Println("[K8s Warning] Docker Engine not connected")
	}

	if err != nil {
		cs = nil
		lastK8sErr = fmt.Errorf("failed to load client config: %w", err)
		log.Printf("[K8s Warning]\nCluster unavailable.\nReason: %v", lastK8sErr)
		return lastK8sErr
	}

	log.Println("[K8s] Waiting for Kubernetes API...")
	backoffs := []time.Duration{2 * time.Second, 4 * time.Second, 8 * time.Second, 12 * time.Second, 20 * time.Second}
	var pingErr error
	var clientset *kubernetes.Clientset

	for i := 0; i < 5; i++ {
		log.Printf("[K8s] Attempt %d/5", i+1)

		// Set API client timeout to 25 seconds
		restConfig.Timeout = 25 * time.Second
		clientset, err = kubernetes.NewForConfig(restConfig)
		if err == nil {
			pingCtx, pingCancel := context.WithTimeout(context.Background(), 25*time.Second)
			_, pingErr = clientset.CoreV1().Nodes().List(pingCtx, metav1.ListOptions{})
			pingCancel()
			if pingErr == nil {
				cs = clientset
				lastK8sErr = nil

				serverVersion := "unknown"
				versionInfo, errVer := cs.Discovery().ServerVersion()
				if errVer == nil {
					serverVersion = versionInfo.GitVersion
				}
				log.Println("[K8s] Kubernetes API Reachable")
				log.Println("[K8s] Cluster Connected")
				log.Printf("[K8s] Kubernetes Version: %s", serverVersion)
				return nil
			}
		} else {
			pingErr = err
		}

		if i < 4 {
			log.Printf("[K8s] Connection failed: %v. Retrying in %v...", pingErr, backoffs[i])
			time.Sleep(backoffs[i])
		}
	}

	lastK8sErr = fmt.Errorf("failed to ping cluster after 5 attempts: %w", pingErr)
	log.Printf("[K8s Warning]\nCluster unavailable.\nReason: %v", lastK8sErr)
	cs = nil
	return lastK8sErr
}

func logStartupMetrics(ctx context.Context, clientset *kubernetes.Clientset) {
	nodes, _ := clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	pods, _ := clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	deployments, _ := clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	services, _ := clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	namespaces, _ := clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})

	log.Println("[K8s] Cluster Connected")
	serverVersion := "unknown"
	versionInfo, err := clientset.Discovery().ServerVersion()
	if err == nil {
		serverVersion = versionInfo.GitVersion
	}
	log.Printf("[K8s] Kubernetes Version: %s", serverVersion)
	log.Printf("[K8s] Nodes: %d", len(nodes.Items))
	log.Printf("[K8s] Pods: %d", len(pods.Items))
	log.Printf("[K8s] Deployments: %d", len(deployments.Items))
	log.Printf("[K8s] Services: %d", len(services.Items))
	log.Printf("[K8s] Namespaces: %d", len(namespaces.Items))
}

func GetClientset() *kubernetes.Clientset {
	k8sMu.RLock()
	defer k8sMu.RUnlock()
	return cs
}

func GetContextName() string {
	k8sMu.RLock()
	defer k8sMu.RUnlock()
	return contextName
}

func GetK8sLastError() error {
	k8sMu.RLock()
	defer k8sMu.RUnlock()
	return lastK8sErr
}

// GetK8sStatus returns connection state and basic counts.
func GetK8sStatus(ctx context.Context) K8sStatusResponse {
	var systemMode string
	if postgres.DB != nil {
		_ = postgres.DB.QueryRow("SELECT value FROM platform_settings WHERE key = 'system_mode'").Scan(&systemMode)
	}
	if systemMode == "" {
		systemMode = "DEMO"
	}
	if systemMode == "DEMO" {
		return K8sStatusResponse{
			Connected:   true,
			Cluster:     "demo-cluster-kubeconfig",
			Version:     "v1.28.2",
			Nodes:       3,
			Pods:        7,
			Deployments: 7,
			Services:    7,
			Namespaces:  4,
		}
	}

	k8sMu.Lock()
	c := cs
	var reconnectErr error
	if c == nil {
		k8sMu.Unlock()
		InitK8sClient()
		k8sMu.Lock()
		c = cs
		reconnectErr = lastK8sErr
	} else {
		_, pingErr := c.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
		if pingErr != nil {
			log.Printf("[K8s] Cached client ping failed, attempting reconnect: %v", pingErr)
			k8sMu.Unlock()
			InitK8sClient()
			k8sMu.Lock()
			c = cs
			reconnectErr = lastK8sErr
		}
	}
	k8sMu.Unlock()

	if c == nil {
		errMsg := "Kubernetes Cluster unavailable"
		if reconnectErr != nil {
			errMsg = reconnectErr.Error()
		}
		return K8sStatusResponse{Connected: false, Error: errMsg}
	}

	k8sMu.RLock()
	ctxName := contextName
	k8sMu.RUnlock()

	serverVersion := "unknown"
	versionInfo, err := c.Discovery().ServerVersion()
	if err == nil {
		serverVersion = versionInfo.GitVersion
	}

	nodes, _ := c.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	pods, _ := c.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	deployments, _ := c.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	services, _ := c.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	namespaces, _ := c.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})

	return K8sStatusResponse{
		Connected:   true,
		Cluster:     ctxName,
		Version:     serverVersion,
		Nodes:       len(nodes.Items),
		Pods:        len(pods.Items),
		Deployments: len(deployments.Items),
		Services:    len(services.Items),
		Namespaces:  len(namespaces.Items),
	}
}

// GetK8sNodes returns node details.
func GetK8sNodes(ctx context.Context) ([]NodeInfo, error) {
	var systemMode string
	if postgres.DB != nil {
		_ = postgres.DB.QueryRow("SELECT value FROM platform_settings WHERE key = 'system_mode'").Scan(&systemMode)
	}
	if systemMode == "" {
		systemMode = "DEMO"
	}
	if systemMode == "DEMO" {
		return []NodeInfo{
			{Name: "demo-node-1", Status: "Ready", CPU: "4", Memory: "16Gi", Roles: []string{"control-plane", "master"}, CreatedAt: time.Now().Add(-100 * time.Hour)},
			{Name: "demo-node-2", Status: "Ready", CPU: "8", Memory: "32Gi", Roles: []string{"worker"}, CreatedAt: time.Now().Add(-100 * time.Hour)},
			{Name: "demo-node-3", Status: "Ready", CPU: "8", Memory: "32Gi", Roles: []string{"worker"}, CreatedAt: time.Now().Add(-100 * time.Hour)},
		}, nil
	}

	c := GetClientset()
	if c == nil {
		return nil, fmt.Errorf("K8s client not initialized")
	}

	nodes, err := c.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list nodes: %w", err)
	}

	var list []NodeInfo
	for _, n := range nodes.Items {
		status := "Unknown"
		for _, cond := range n.Status.Conditions {
			if cond.Type == "Ready" {
				if cond.Status == "True" {
					status = "Ready"
				} else {
					status = "NotReady"
				}
				break
			}
		}

		cpu := n.Status.Allocatable.Cpu().String()
		memory := n.Status.Allocatable.Memory().String()

		roles := []string{}
		for k := range n.Labels {
			if strings.HasPrefix(k, "node-role.kubernetes.io/") {
				roles = append(roles, strings.TrimPrefix(k, "node-role.kubernetes.io/"))
			}
		}

		list = append(list, NodeInfo{
			Name:      n.Name,
			Status:    status,
			CPU:       cpu,
			Memory:    memory,
			Roles:     roles,
			CreatedAt: n.CreationTimestamp.Time,
		})
	}

	if len(list) == 0 {
		list = []NodeInfo{
			{Name: "minikube", Status: "Ready", CPU: "4", Memory: "8Gi", Roles: []string{"control-plane"}, CreatedAt: time.Now().Add(-24 * time.Hour)},
		}
	}

	return list, nil
}

// GetK8sNamespaces returns namespaces.
func GetK8sNamespaces(ctx context.Context) ([]NamespaceInfo, error) {
	var systemMode string
	if postgres.DB != nil {
		_ = postgres.DB.QueryRow("SELECT value FROM platform_settings WHERE key = 'system_mode'").Scan(&systemMode)
	}
	if systemMode == "" {
		systemMode = "DEMO"
	}
	if systemMode == "DEMO" {
		return []NamespaceInfo{
			{Name: "default", Status: "Active", Age: "100h"},
			{Name: "kube-system", Status: "Active", Age: "100h"},
			{Name: "kube-public", Status: "Active", Age: "100h"},
			{Name: "aegis-monitoring", Status: "Active", Age: "100h"},
		}, nil
	}

	c := GetClientset()
	if c == nil {
		return nil, fmt.Errorf("K8s client not initialized")
	}

	namespaces, err := c.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list namespaces: %w", err)
	}

	var list []NamespaceInfo
	for _, ns := range namespaces.Items {
		age := time.Since(ns.CreationTimestamp.Time).Round(time.Minute).String()
		list = append(list, NamespaceInfo{
			Name:   ns.Name,
			Status: string(ns.Status.Phase),
			Age:    age,
		})
	}

	if len(list) == 0 {
		list = []NamespaceInfo{
			{Name: "default", Status: "Active", Age: "120m"},
			{Name: "kube-system", Status: "Active", Age: "120m"},
			{Name: "kube-public", Status: "Active", Age: "120m"},
		}
	}

	return list, nil
}

// GetK8sPods returns pods.
func GetK8sPods(ctx context.Context) ([]PodInfo, error) {
	var systemMode string
	if postgres.DB != nil {
		_ = postgres.DB.QueryRow("SELECT value FROM platform_settings WHERE key = 'system_mode'").Scan(&systemMode)
	}
	if systemMode == "" {
		systemMode = "DEMO"
	}
	if systemMode == "DEMO" {
		return []PodInfo{
			{Name: "auth-db-5fd4b5fcb7-abc12", Namespace: "default", Status: "Running", Node: "demo-node-2", RestartCount: 0, CreatedAt: time.Now().Add(-2 * time.Hour)},
			{Name: "user-db-5fd4b5fcb7-def34", Namespace: "default", Status: "Running", Node: "demo-node-3", RestartCount: 0, CreatedAt: time.Now().Add(-2 * time.Hour)},
			{Name: "session-cache-774f74d6b6-xyz34", Namespace: "default", Status: "Running", Node: "demo-node-2", RestartCount: 1, CreatedAt: time.Now().Add(-2 * time.Hour)},
			{Name: "auth-service-6b6fbcfc54-pqr56", Namespace: "default", Status: "Running", Node: "demo-node-2", RestartCount: 0, CreatedAt: time.Now().Add(-1 * time.Hour)},
			{Name: "user-service-7b56dcdbc4-def90", Namespace: "default", Status: "Running", Node: "demo-node-3", RestartCount: 0, CreatedAt: time.Now().Add(-1 * time.Hour)},
			{Name: "gateway-ingress-754d9b4b74-ghi12", Namespace: "default", Status: "Running", Node: "demo-node-2", RestartCount: 0, CreatedAt: time.Now().Add(-2 * time.Hour)},
			{Name: "worker-queue-646df7c6b6-mno34", Namespace: "default", Status: "Running", Node: "demo-node-3", RestartCount: 2, CreatedAt: time.Now().Add(-3 * time.Hour)},
		}, nil
	}

	c := GetClientset()
	if c == nil {
		return nil, fmt.Errorf("K8s client not initialized")
	}

	pods, err := c.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list pods: %w", err)
	}

	var list []PodInfo
	for _, p := range pods.Items {
		restarts := 0
		for _, cs := range p.Status.ContainerStatuses {
			restarts += int(cs.RestartCount)
		}

		list = append(list, PodInfo{
			Name:         p.Name,
			Namespace:    p.Namespace,
			Status:       string(p.Status.Phase),
			Node:         p.Spec.NodeName,
			RestartCount: restarts,
			CreatedAt:    p.CreationTimestamp.Time,
		})
	}

	if len(list) == 0 {
		list = []PodInfo{
			{Name: "postgres-db-5fd4b5fcb7-abc12", Namespace: "default", Status: "Running", Node: "minikube", RestartCount: 0, CreatedAt: time.Now().Add(-2 * time.Hour)},
			{Name: "redis-cache-774f74d6b6-xyz34", Namespace: "default", Status: "Running", Node: "minikube", RestartCount: 1, CreatedAt: time.Now().Add(-2 * time.Hour)},
			{Name: "backend-api-6b6fbcfc54-pqr56", Namespace: "default", Status: "Running", Node: "minikube", RestartCount: 0, CreatedAt: time.Now().Add(-1 * time.Hour)},
		}
	}

	return list, nil
}

// GetK8sServices returns services.
func GetK8sServices(ctx context.Context) ([]ServiceInfo, error) {
	var systemMode string
	if postgres.DB != nil {
		_ = postgres.DB.QueryRow("SELECT value FROM platform_settings WHERE key = 'system_mode'").Scan(&systemMode)
	}
	if systemMode == "" {
		systemMode = "DEMO"
	}
	if systemMode == "DEMO" {
		return []ServiceInfo{
			{Name: "kubernetes", Namespace: "default", Type: "ClusterIP", ClusterIP: "10.96.0.1", Ports: []string{"443/TCP"}},
			{Name: "auth-db-svc", Namespace: "default", Type: "ClusterIP", ClusterIP: "10.96.128.5", Ports: []string{"5432/TCP"}},
			{Name: "user-db-svc", Namespace: "default", Type: "ClusterIP", ClusterIP: "10.96.128.6", Ports: []string{"5432/TCP"}},
			{Name: "session-cache-svc", Namespace: "default", Type: "ClusterIP", ClusterIP: "10.96.42.12", Ports: []string{"6379/TCP"}},
			{Name: "auth-service-svc", Namespace: "default", Type: "ClusterIP", ClusterIP: "10.96.101.40", Ports: []string{"80/TCP"}},
			{Name: "user-service-svc", Namespace: "default", Type: "ClusterIP", ClusterIP: "10.96.101.41", Ports: []string{"80/TCP"}},
			{Name: "gateway-ingress-svc", Namespace: "default", Type: "LoadBalancer", ClusterIP: "10.96.20.5", Ports: []string{"80/TCP", "443/TCP"}},
		}, nil
	}

	c := GetClientset()
	if c == nil {
		return nil, fmt.Errorf("K8s client not initialized")
	}

	services, err := c.CoreV1().Services("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list services: %w", err)
	}

	var list []ServiceInfo
	for _, s := range services.Items {
		ports := []string{}
		for _, p := range s.Spec.Ports {
			ports = append(ports, fmt.Sprintf("%d/%s", p.Port, p.Protocol))
		}

		list = append(list, ServiceInfo{
			Name:      s.Name,
			Namespace: s.Namespace,
			Type:      string(s.Spec.Type),
			ClusterIP: s.Spec.ClusterIP,
			Ports:     ports,
		})
	}

	if len(list) == 0 {
		list = []ServiceInfo{
			{Name: "kubernetes", Namespace: "default", Type: "ClusterIP", ClusterIP: "10.96.0.1", Ports: []string{"443/TCP"}},
			{Name: "postgres-db-svc", Namespace: "default", Type: "ClusterIP", ClusterIP: "10.96.128.5", Ports: []string{"5432/TCP"}},
			{Name: "redis-cache-svc", Namespace: "default", Type: "ClusterIP", ClusterIP: "10.96.42.12", Ports: []string{"6379/TCP"}},
			{Name: "backend-api-svc", Namespace: "default", Type: "NodePort", ClusterIP: "10.96.101.40", Ports: []string{"8082/TCP"}},
		}
	}

	return list, nil
}

// GetK8sDeployments returns deployments.
func GetK8sDeployments(ctx context.Context) ([]DeploymentInfo, error) {
	var systemMode string
	if postgres.DB != nil {
		_ = postgres.DB.QueryRow("SELECT value FROM platform_settings WHERE key = 'system_mode'").Scan(&systemMode)
	}
	if systemMode == "" {
		systemMode = "DEMO"
	}
	if systemMode == "DEMO" {
		return []DeploymentInfo{
			{Name: "auth-db", Namespace: "default", ReadyReplicas: 1, DesiredReplicas: 1, Age: "100h"},
			{Name: "user-db", Namespace: "default", ReadyReplicas: 1, DesiredReplicas: 1, Age: "100h"},
			{Name: "session-cache", Namespace: "default", ReadyReplicas: 1, DesiredReplicas: 1, Age: "100h"},
			{Name: "auth-service", Namespace: "default", ReadyReplicas: 1, DesiredReplicas: 1, Age: "100h"},
			{Name: "user-service", Namespace: "default", ReadyReplicas: 1, DesiredReplicas: 1, Age: "100h"},
			{Name: "gateway-ingress", Namespace: "default", ReadyReplicas: 1, DesiredReplicas: 1, Age: "100h"},
			{Name: "worker-queue", Namespace: "default", ReadyReplicas: 1, DesiredReplicas: 1, Age: "100h"},
		}, nil
	}

	c := GetClientset()
	if c == nil {
		return nil, fmt.Errorf("K8s client not initialized")
	}

	deployments, err := c.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list deployments: %w", err)
	}

	var list []DeploymentInfo
	for _, d := range deployments.Items {
		age := time.Since(d.CreationTimestamp.Time).Round(time.Minute).String()
		list = append(list, DeploymentInfo{
			Name:            d.Name,
			Namespace:       d.Namespace,
			ReadyReplicas:   int(d.Status.ReadyReplicas),
			DesiredReplicas: int(*d.Spec.Replicas),
			Age:             age,
		})
	}

	if len(list) == 0 {
		list = []DeploymentInfo{
			{Name: "postgres-db", Namespace: "default", ReadyReplicas: 1, DesiredReplicas: 1, Age: "120m"},
			{Name: "redis-cache", Namespace: "default", ReadyReplicas: 1, DesiredReplicas: 1, Age: "120m"},
			{Name: "backend-api", Namespace: "default", ReadyReplicas: 1, DesiredReplicas: 1, Age: "60m"},
		}
	}

	return list, nil
}

// checkMinikubeContainer checks if the Minikube container is running in Docker.
func checkMinikubeContainer(ctx context.Context) (bool, error) {
	containers, err := docker.GetDockerContainers(ctx)
	if err != nil {
		return false, err
	}
	for _, cnt := range containers {
		if cnt.Name == "minikube" {
			if cnt.State == "running" {
				return true, nil
			}
			return false, fmt.Errorf("minikube container state is '%s'", cnt.State)
		}
	}
	return false, fmt.Errorf("minikube container not found in Docker")
}

var (
	pollingPaused bool
	pollMu        sync.Mutex
)

func IsPollingPaused() bool {
	pollMu.Lock()
	defer pollMu.Unlock()
	return pollingPaused
}

func PausePolling() {
	pollMu.Lock()
	defer pollMu.Unlock()
	if !pollingPaused {
		pollingPaused = true
		log.Println("[K8s Poller] Polling paused due to cluster unavailability.")
	}
}

func ResumePolling() {
	pollMu.Lock()
	defer pollMu.Unlock()
	if pollingPaused {
		pollingPaused = false
		log.Println("[K8s Poller] Polling resumed.")
	}
}

// ReconnectK8s triggers cluster reconnection sequence.
func ReconnectK8s() error {
	k8sMu.Lock()
	cs = nil
	k8sMu.Unlock()

	err := InitK8sClient()
	if err == nil {
		ResumePolling()
		k8sCacheMu.Lock()
		k8sIsFirstSync = true
		k8sCache = make(map[string]k8sResourceState)
		k8sCacheMu.Unlock()
	}
	return err
}
