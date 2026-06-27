package kubernetes

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type K8sRecommendation struct {
	ID          string `json:"id"`
	Agent       string `json:"agent"`
	Target      string `json:"target"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Difficulty  string `json:"difficulty"`
	Impact      string `json:"impact"`
	Status      string `json:"status"`
}

// GetRecommendations returns pod debugging recommendations.
func GetRecommendations(ctx context.Context) ([]K8sRecommendation, error) {
	c := GetClientset()
	if c == nil {
		return nil, fmt.Errorf("K8s client not initialized")
	}

	pods, err := c.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	var recs []K8sRecommendation
	for _, p := range pods.Items {
		phase := string(p.Status.Phase)
		if phase == "Pending" || phase == "Failed" || phase == "Unknown" {
			recs = append(recs, K8sRecommendation{
				ID:          fmt.Sprintf("rec-k8s-pod-%s-%s", p.Namespace, p.Name),
				Agent:       "Reliability Agent",
				Target:      p.Name,
				Type:        "K8s Pod Recovery",
				Description: fmt.Sprintf("Run: 'kubectl describe pod %s -n %s' and 'kubectl logs %s -n %s' to inspect failed pod state.", p.Name, p.Namespace, p.Name, p.Namespace),
				Difficulty:  "Low",
				Impact:      "High",
				Status:      "Pending",
			})
		}

		for _, cs := range p.Status.ContainerStatuses {
			if cs.State.Waiting != nil && (cs.State.Waiting.Reason == "CrashLoopBackOff" || cs.State.Waiting.Reason == "ImagePullBackOff") {
				recs = append(recs, K8sRecommendation{
					ID:          fmt.Sprintf("rec-k8s-wait-%s-%s-%s", p.Namespace, p.Name, cs.Name),
					Agent:       "Reliability Agent",
					Target:      p.Name,
					Type:        "Container Failure Mitigate",
					Description: fmt.Sprintf("Run: 'kubectl logs %s -c %s -n %s' to diagnose waiting state '%s'.", p.Name, cs.Name, p.Namespace, cs.State.Waiting.Reason),
					Difficulty:  "Medium",
					Impact:      "High",
					Status:      "Pending",
				})
			}
		}
	}

	return recs, nil
}
