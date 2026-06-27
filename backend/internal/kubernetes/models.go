package kubernetes

import "time"

type K8sStatusResponse struct {
	Connected   bool   `json:"connected"`
	Cluster     string `json:"cluster,omitempty"`
	Status      string `json:"status,omitempty"`
	Reason      string `json:"reason,omitempty"`
	Version     string `json:"version,omitempty"`
	Nodes       int    `json:"nodes,omitempty"`
	Pods        int    `json:"pods,omitempty"`
	Deployments int    `json:"deployments,omitempty"`
	Services    int    `json:"services,omitempty"`
	Namespaces  int    `json:"namespaces,omitempty"`
	Error       string `json:"error,omitempty"`
}

type NodeInfo struct {
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CPU       string    `json:"cpu"`
	Memory    string    `json:"memory"`
	Roles     []string  `json:"roles"`
	CreatedAt time.Time `json:"createdAt"`
}

type NamespaceInfo struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Age    string `json:"age"`
}

type PodInfo struct {
	Name         string    `json:"name"`
	Namespace    string    `json:"namespace"`
	Status       string    `json:"status"`
	Node         string    `json:"node"`
	RestartCount int       `json:"restartCount"`
	CreatedAt    time.Time `json:"createdAt"`
}

type ServiceInfo struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Type      string   `json:"type"`
	ClusterIP string   `json:"clusterIP"`
	Ports     []string `json:"ports"`
}

type DeploymentInfo struct {
	Name            string `json:"name"`
	Namespace       string `json:"namespace"`
	ReadyReplicas   int    `json:"readyReplicas"`
	DesiredReplicas int    `json:"desiredReplicas"`
	Age             string `json:"age"`
}
