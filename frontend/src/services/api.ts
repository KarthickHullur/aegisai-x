export const BASE_URL = 'http://localhost:8082';

/**
 * Generic helper to make fetch requests to the backend API.
 */
async function fetchFromApi<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

// ----------------------------------------------------
// Type Definitions
// ----------------------------------------------------

export interface MetricTrend {
  value: number;
  unit: string;
  trend?: string;
}

export interface MemoryUsage {
  allocated_bytes: number;
  total_bytes: number;
  unit: string;
  percentage: number;
}

export interface NetworkThroughput {
  ingress_mbps: number;
  egress_mbps: number;
}

export interface MetricsData {
  cpu_utilization: MetricTrend;
  memory_usage: MemoryUsage;
  network_throughput: NetworkThroughput;
  success_rate: MetricTrend;
  active_connections: number;
  anomaly_probability: number;
}

export interface MetricsResponse {
  timestamp: string;
  data: MetricsData;
}

export interface IncidentResponseItem {
  id: number;
  incident_code: string;
  title: string;
  severity: string;
  status: string;
  occurrence_count: number;
  logs: string;
  last_seen: string;
  created_at: string;
  source?: string;
  time?: string;
}

export interface IncidentsResponse {
  data: IncidentResponseItem[];
}

export interface AgentResponseItem {
  name: string;
  status: string;
}

export interface AgentsResponse {
  data: AgentResponseItem[];
}

export interface ResourceItem {
  name: string;
  type: string;
  status: string;
  cloud: string;
}

export interface ResourcesResponse {
  data: ResourceItem[];
}

export interface SecurityResponse {
  security_score: number;
  compliance: {
    soc2: string;
    iso27001: string;
    hipaa: string;
    cis_bench: string;
  };
  vulnerabilities: Array<{
    id: string;
    cve: string;
    severity: string;
    title: string;
    component: string;
    status: string;
    discovered: string;
  }>;
  key_rotations: {
    active_rotations: number;
    expired_keys: number;
    status: string;
  };
}

export interface MemoryResponse {
  vector_db: {
    provider: string;
    total_nodes: number;
    index_status: string;
  };
  memory_fragments: Array<{
    id: string;
    title: string;
    source: string;
    relevance: number;
    summary: string;
    updated_at: string;
  }>;
}

export interface CostsResponse {
  potential_savings_monthly: number;
  active_waste_count: number;
  efficiency_index: number;
  applied_savings_monthly: number;
  opportunities: Array<{
    id: string;
    resource_name: string;
    category: string;
    waste_reason: string;
    recommendation: string;
    monthly_savings: number;
    status: string;
  }>;
}

export interface TopologyNode {
  id: string;
  label: string;
  type: string;
  status: string;
  x: number;
  y: number;
  connections: string[];
}

export interface TopologyResponse {
  nodes: TopologyNode[];
}

export interface AlertItem {
  id: string;
  severity: string;
  title: string;
  source: string;
  status: string;
  timestamp: string;
}

export interface AlertsResponse {
  data: AlertItem[];
}

export interface InvestigationItem {
  incident_id: string;
  agent: string;
  target: string;
  status: string;
  findings: string[];
  timestamp: string;
}

export interface InvestigationsResponse {
  data: InvestigationItem[];
}

export interface RecommendationItem {
  id: string;
  agent: string;
  target: string;
  type: string;
  description: string;
  difficulty: string;
  impact: string;
  status: string;
}

export interface RecommendationsResponse {
  data: RecommendationItem[];
}

export interface ClusterItem {
  id: string;
  name: string;
  region: string;
  provider: string;
  nodes: number;
  cpu_cores: number;
  memory_gb: number;
  health: string;
  namespaces: string[];
}

export interface ClustersResponse {
  data: ClusterItem[];
}

export interface DeploymentItem {
  name: string;
  namespace: string;
  version: string;
  replicas: {
    desired: number;
    current: number;
    ready: number;
  };
  status: string;
  cpu_usage: string;
  memory_usage: string;
}

export interface DeploymentsResponse {
  data: DeploymentItem[];
}

// ----------------------------------------------------
// Reusable API Fetch Functions
// ----------------------------------------------------

export function getMetrics(): Promise<MetricsResponse> {
  return fetchFromApi<MetricsResponse>('/metrics');
}

export function getIncidents(): Promise<IncidentsResponse> {
  return fetchFromApi<IncidentsResponse>('/incidents');
}

export function getAgents(): Promise<AgentsResponse> {
  return fetchFromApi<AgentsResponse>('/agents');
}

export function getResources(): Promise<ResourcesResponse> {
  return fetchFromApi<ResourcesResponse>('/resources');
}

export function getSecurity(): Promise<SecurityResponse> {
  return fetchFromApi<SecurityResponse>('/security');
}

export function getMemory(): Promise<MemoryResponse> {
  return fetchFromApi<MemoryResponse>('/memory');
}

export function getCosts(): Promise<CostsResponse> {
  return fetchFromApi<CostsResponse>('/costs');
}

export function getTopology(): Promise<TopologyResponse> {
  return fetchFromApi<TopologyResponse>('/topology');
}

export function getAlerts(): Promise<AlertsResponse> {
  return fetchFromApi<AlertsResponse>('/alerts');
}

export function getInvestigations(): Promise<InvestigationsResponse> {
  return fetchFromApi<InvestigationsResponse>('/investigations');
}

export function getRecommendations(): Promise<RecommendationsResponse> {
  return fetchFromApi<RecommendationsResponse>('/recommendations');
}

export function getClusters(): Promise<ClustersResponse> {
  return fetchFromApi<ClustersResponse>('/clusters');
}

export function getDeployments(): Promise<DeploymentsResponse> {
  return fetchFromApi<DeploymentsResponse>('/deployments');
}

// ----------------------------------------------------
// AI Investigator Types and Functions
// ----------------------------------------------------

export interface AIInvestigateRequest {
  incident: string;
  severity: string;
  logs: string;
}

export interface AIInvestigateResponse {
  summary: string;
  rootCause: string;
  impact: string;
  recommendations: string[];
}

export class ApiError extends Error {
  status?: number;
  details?: any;

  constructor(message: string, status?: number, details?: any) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = 'ApiError';
  }
}

export function investigateIncident(data: AIInvestigateRequest): Promise<AIInvestigateResponse> {
  return fetch(`${BASE_URL}/ai/investigate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
    .then(async (response) => {
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new ApiError(
          errBody.error || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errBody.details || errBody
        );
      }
      return response.json() as Promise<AIInvestigateResponse>;
    })
    .catch((err) => {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError('Unable to reach AegisAI-X backend', 0);
    });
}

export interface HistoricalInvestigation {
  id: number;
  incident_id: string;
  incident_title: string;
  summary: string;
  root_cause: string;
  impact: string;
  recommendations: string[];
  timestamp: string;
}

export interface InvestigationItem {
  id: number;
  summary: string;
  rootCause: string;
  impact: string;
  recommendations: string[];
  timestamp: string;
}

export interface GroupedInvestigation {
  incidentId: string;
  title: string;
  occurrences: number;
  lastInvestigated: string;
  investigations: InvestigationItem[];
}

export function searchMemory(query: string): Promise<{ data: HistoricalInvestigation[] }> {
  return fetchFromApi<{ data: HistoricalInvestigation[] }>(`/memory/search?q=${encodeURIComponent(query)}`);
}

export function getRecentInvestigations(): Promise<{ data: GroupedInvestigation[] }> {
  return fetchFromApi<{ data: GroupedInvestigation[] }>('/memory/recent');
}

export interface ChatFragment {
  role: 'user' | 'model' | 'assistant';
  content: string;
}

export interface AICopilotRequest {
  message: string;
  history: ChatFragment[];
}

export interface AICopilotResponse {
  answer: string;
}

export function askCopilot(data: AICopilotRequest): Promise<AICopilotResponse> {
  return fetch(`${BASE_URL}/ai/copilot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  }).then(async (response) => {
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new ApiError(
        errBody.error || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errBody.details || errBody
      );
    }
    return response.json() as Promise<AICopilotResponse>;
  });
}

export interface CopilotHistoryItem {
  id: number;
  question: string;
  response: string;
  created_at: string;
}

export interface CopilotHistoryResponse {
  data: CopilotHistoryItem[];
}

export function getCopilotHistory(): Promise<CopilotHistoryResponse> {
  return fetchFromApi<CopilotHistoryResponse>('/ai/copilot/history');
}

export function deleteCopilotHistory(id: number): Promise<any> {
  return fetch(`${BASE_URL}/ai/copilot/history/${id}`, {
    method: 'DELETE',
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Failed to delete copilot history item: ${response.statusText}`);
    }
    return response.json();
  });
}

export interface DockerStatus {
  connected: boolean;
  engineVersion?: string;
  containers?: number;
  running?: number;
  stopped?: number;
  images?: number;
  volumes?: number;
  networks?: number;
  error?: string;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  created: string;
  ports: string[];
}

export interface DockerContainerStats {
  containerId: string;
  name: string;
  cpuPercent: number;
  memoryPercent: number;
  networkIO: string;
  blockIO: string;
}

export function getDockerStatus(): Promise<DockerStatus> {
  return fetchFromApi<DockerStatus>('/docker/status');
}

export function getDockerContainers(): Promise<DockerContainer[]> {
  return fetchFromApi<DockerContainer[]>('/docker/containers');
}

export function getDockerStats(): Promise<DockerContainerStats[]> {
  return fetchFromApi<DockerContainerStats[]>('/docker/stats');
}

// ----------------------------------------------------
// Kubernetes Types and Functions
// ----------------------------------------------------

export interface K8sStatus {
  connected: boolean;
  cluster?: string;
  status?: string;
  reason?: string;
  version?: string;
  nodes?: number;
  pods?: number;
  deployments?: number;
  services?: number;
  namespaces?: number;
  error?: string;
}

export function reconnectK8s(): Promise<{ status: string; message: string }> {
  return fetch(`${BASE_URL}/k8s/reconnect`, {
    method: 'POST',
  }).then(async (response) => {
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `Failed to reconnect K8s: ${response.statusText}`);
    }
    return response.json() as Promise<{ status: string; message: string }>;
  });
}

export interface K8sNode {
  name: string;
  status: string;
  cpu: string;
  memory: string;
  roles: string[];
  createdAt: string;
}

export interface K8sNamespace {
  name: string;
  status: string;
  age: string;
}

export interface K8sPod {
  name: string;
  namespace: string;
  status: string;
  node: string;
  restartCount: number;
  createdAt: string;
}

export interface K8sService {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  ports: string[];
}

export interface K8sDeployment {
  name: string;
  namespace: string;
  readyReplicas: number;
  desiredReplicas: number;
  age: string;
}

export function getK8sStatus(): Promise<K8sStatus> {
  return fetchFromApi<K8sStatus>('/k8s/status');
}

export function getK8sNodes(): Promise<K8sNode[]> {
  return fetchFromApi<K8sNode[]>('/k8s/nodes');
}

export function getK8sNamespaces(): Promise<K8sNamespace[]> {
  return fetchFromApi<K8sNamespace[]>('/k8s/namespaces');
}

export function getK8sPods(): Promise<K8sPod[]> {
  return fetchFromApi<K8sPod[]>('/k8s/pods');
}

export function getK8sServices(): Promise<K8sService[]> {
  return fetchFromApi<K8sService[]>('/k8s/services');
}

export function getK8sDeployments(): Promise<K8sDeployment[]> {
  return fetchFromApi<K8sDeployment[]>('/k8s/deployments');
}

export interface HistoricalMetricData {
  time: string;
  load: number;
  anomalyProb: number;
}

export function getHistoricalMetrics(type: 'docker' | 'kubernetes' | 'prometheus'): Promise<{ data: HistoricalMetricData[] }> {
  return fetchFromApi<{ data: HistoricalMetricData[] }>(`/metrics/historical?type=${type}`);
}

export interface PrometheusStatus {
  connected: boolean;
  version?: string;
  activeAlerts: number;
  metricsCount: number;
  targetsTotal?: number;
  targetsHealthy?: number;
  queryLatencyMs?: number;
  error?: string;
}

export interface PrometheusAlert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  state: string;
  activeAt: string;
  value: string;
}

export function getPrometheusStatus(): Promise<PrometheusStatus> {
  return fetchFromApi<PrometheusStatus>('/prometheus/status');
}

export function getPrometheusAlerts(): Promise<{ status: string; data: { alerts: PrometheusAlert[] } }> {
  return fetchFromApi<{ status: string; data: { alerts: PrometheusAlert[] } }>('/prometheus/alerts');
}

export function queryPrometheus(query: string): Promise<any> {
  return fetchFromApi<any>(`/prometheus/query?query=${encodeURIComponent(query)}`);
}

export function queryRangePrometheus(query: string, start: string, end: string, step: string): Promise<any> {
  return fetchFromApi<any>(`/prometheus/query_range?query=${encodeURIComponent(query)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&step=${encodeURIComponent(step)}`);
}

export function getPrometheusMetrics(): Promise<{ status: string; data: string[] }> {
  return fetchFromApi<{ status: string; data: string[] }>('/prometheus/metrics');
}

export interface SecurityBreakdownItem {
  name: string;
  status: string;
  points: number;
}

export interface SecurityScoreResponse {
  score: number;
  grade: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  environment: string;
  reason: string;
  dockerFindingsPenalty: number;
  k8sFindingsPenalty: number;
  devAdjustments: number;
  breakdown: SecurityBreakdownItem[];
  lastUpdated: string;
}

export function getSecurityScore(): Promise<SecurityScoreResponse> {
  return fetchFromApi<SecurityScoreResponse>('/security/score');
}

// ----------------------------------------------------
// Azure Types and Functions
// ----------------------------------------------------

export interface AzureStatus {
  connected: boolean;
  subscription?: string;
  error?: string;
  lastUpdated: string;
}

export interface AzureSubscription {
  id: string;
  subscriptionId: string;
  displayName: string;
  state: string;
  isLive: boolean;
}

export interface AzureResourceGroup {
  id: string;
  name: string;
  location: string;
  provisioningState: string;
  tags?: Record<string, string>;
  isLive: boolean;
}

export interface AzureVM {
  id: string;
  name: string;
  location: string;
  status: string;
  size: string;
  osType: string;
  isLive: boolean;
}

export interface AzureStorageAccount {
  id: string;
  name: string;
  location: string;
  status: string;
  sku: string;
  accessTier: string;
  publicNetworkAccess: string;
  isLive: boolean;
}

export interface AzureAKSCluster {
  id: string;
  name: string;
  location: string;
  status: string;
  version: string;
  nodeCount: number;
  isLive: boolean;
}

export interface AzureResource {
  id: string;
  name: string;
  location: string;
  status: string;
  type: string;
  isLive: boolean;
}

export interface AzureSecurityFinding {
  id: string;
  severity: string;
  resource: string;
  recommendation: string;
  status: string;
}

export interface AzureCost {
  date: string;
  resourceGroup: string;
  cost: number;
  currency: string;
}

export interface AzureRecommendation {
  id: string;
  resource: string;
  category: string;
  recommendation: string;
  impact: string;
}

export function getAzureStatus(): Promise<AzureStatus> {
  return fetchFromApi<AzureStatus>('/azure/status');
}

export function getAzureSubscriptions(): Promise<AzureSubscription[]> {
  return fetchFromApi<AzureSubscription[]>('/azure/subscriptions');
}

export function getAzureResourceGroups(): Promise<AzureResourceGroup[]> {
  return fetchFromApi<AzureResourceGroup[]>('/azure/resource-groups');
}

export function getAzureVMs(): Promise<AzureVM[]> {
  return fetchFromApi<AzureVM[]>('/azure/vms');
}

export function getAzureStorage(): Promise<AzureStorageAccount[]> {
  return fetchFromApi<AzureStorageAccount[]>('/azure/storage');
}

export function getAzureAKS(): Promise<AzureAKSCluster[]> {
  return fetchFromApi<AzureAKSCluster[]>('/azure/aks');
}

export function getAzureResources(): Promise<AzureResource[]> {
  return fetchFromApi<AzureResource[]>('/azure/resources');
}

export function getAzureSecurity(): Promise<AzureSecurityFinding[]> {
  return fetchFromApi<AzureSecurityFinding[]>('/azure/security');
}

export function getAzureCosts(): Promise<AzureCost[]> {
  return fetchFromApi<AzureCost[]>('/azure/costs');
}

export function getAzureRecommendations(): Promise<AzureRecommendation[]> {
  return fetchFromApi<AzureRecommendation[]>('/azure/recommendations');
}

export interface AzureProvider {
  namespace: string;
  registrationState: string;
  isLive: boolean;
}

export function getAzureProviders(): Promise<AzureProvider[]> {
  return fetchFromApi<AzureProvider[]>('/azure/providers');
}

// ----------------------------------------------------
// AWS Types and Functions
// ----------------------------------------------------

export interface AwsStatus {
  connected: boolean;
  accountId?: string;
  authSource?: string;
  error?: string;
  lastUpdated: string;
}

export interface AwsAccount {
  id: string;
  arn: string;
  userId: string;
  isLive: boolean;
}

export interface AwsRegion {
  name: string;
  isLive: boolean;
}

export interface AwsEC2Instance {
  id: string;
  name: string;
  region: string;
  state: string;
  instanceType: string;
  tags?: Record<string, string>;
  isLive: boolean;
}

export interface AwsS3Bucket {
  name: string;
  region: string;
  publicAccess: string;
  isLive: boolean;
}

export interface AwsVPC {
  id: string;
  name: string;
  region: string;
  state: string;
  cidrBlock: string;
  isLive: boolean;
}

export interface AwsIAMUser {
  arn: string;
  username: string;
  mfaEnabled: boolean;
  lastLogin?: string;
  isLive: boolean;
}

export interface AwsIAMRole {
  arn: string;
  roleName: string;
  isLive: boolean;
}

export interface AwsIAMPolicy {
  arn: string;
  policyName: string;
  isLive: boolean;
}

export interface AwsIAMAccessKey {
  accessKeyId: string;
  username: string;
  status: string;
  lastUsedDate?: string;
  isLive: boolean;
}

export interface AwsIAMData {
  users: AwsIAMUser[];
  roles: AwsIAMRole[];
  policies: AwsIAMPolicy[];
  accessKeys: AwsIAMAccessKey[];
}

export interface AwsResource {
  id: string;
  name: string;
  type: string;
  region: string;
  status: string;
  isLive: boolean;
}

export interface AwsSecurityFinding {
  id: string;
  severity: string;
  resource: string;
  recommendation: string;
  status: string;
}

export interface AwsRecommendation {
  id: string;
  resource: string;
  category: string;
  recommendation: string;
  impact: string;
}

export function getAwsStatus(): Promise<AwsStatus> {
  return fetchFromApi<AwsStatus>('/aws/status');
}

export function getAwsAccount(): Promise<AwsAccount[]> {
  return fetchFromApi<AwsAccount[]>('/aws/account');
}

export function getAwsRegions(): Promise<AwsRegion[]> {
  return fetchFromApi<AwsRegion[]>('/aws/regions');
}

export function getAwsEC2(): Promise<AwsEC2Instance[]> {
  return fetchFromApi<AwsEC2Instance[]>('/aws/ec2');
}

export function getAwsS3(): Promise<AwsS3Bucket[]> {
  return fetchFromApi<AwsS3Bucket[]>('/aws/s3');
}

export function getAwsVPC(): Promise<AwsVPC[]> {
  return fetchFromApi<AwsVPC[]>('/aws/vpc');
}

export function getAwsIAM(): Promise<AwsIAMData> {
  return fetchFromApi<AwsIAMData>('/aws/iam');
}

export function getAwsResources(): Promise<AwsResource[]> {
  return fetchFromApi<AwsResource[]>('/aws/resources');
}

export function getAwsSecurity(): Promise<AwsSecurityFinding[]> {
  return fetchFromApi<AwsSecurityFinding[]>('/aws/security');
}

export function getAwsRecommendations(): Promise<AwsRecommendation[]> {
  return fetchFromApi<AwsRecommendation[]>('/aws/recommendations');
}

export interface CloudConnectionItem {
  provider: 'docker' | 'kubernetes' | 'azure' | 'aws';
  connectionType: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  metadata?: Record<string, any>;
}

export interface SystemModeResponse {
  mode: 'LIVE' | 'DEMO';
  hasCredentials: boolean;
}

export function getCloudConnections(): Promise<{ data: CloudConnectionItem[] }> {
  return fetchFromApi<{ data: CloudConnectionItem[] }>('/cloud-connections');
}

export async function connectCloudConnection(
  provider: string,
  connectionType: string,
  credentials: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const response = await fetch(`${BASE_URL}/cloud-connections/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, connectionType, credentials }),
  });
  return response.json();
}

export interface TestConnectionResponse {
  success: boolean;
  provider: string;
  connected: boolean;
  message: string;
  metadata?: Record<string, any>;
  error?: string;
}

export async function testCloudConnection(
  provider: string,
  connectionType: string,
  credentials: string
): Promise<TestConnectionResponse> {
  try {
    const response = await fetch(`${BASE_URL}/cloud-connections/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, connectionType, credentials }),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Invalid JSON returned from ${provider} connection test`
      );
    }
    return data;
  } catch (err: any) {
    throw err;
  }
}

export async function disconnectCloudConnection(
  provider: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${BASE_URL}/cloud-connections/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  return response.json();
}

export function getSystemMode(): Promise<SystemModeResponse> {
  return fetchFromApi<SystemModeResponse>('/system/mode');
}

export async function updateSystemMode(
  mode: 'LIVE' | 'DEMO'
): Promise<{ success: boolean; mode?: 'LIVE' | 'DEMO'; error?: string }> {
  const response = await fetch(`${BASE_URL}/system/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  return response.json();
}

export async function getDockerConnectionTest(): Promise<TestConnectionResponse> {
  const response = await fetch(`${BASE_URL}/api/connections/docker/test`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON returned from docker connection test");
  }
}

export async function getK8sConnectionTest(): Promise<TestConnectionResponse> {
  const response = await fetch(`${BASE_URL}/api/connections/kubernetes/test`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON returned from kubernetes connection test");
  }
}

export async function getAzureConnectionTest(): Promise<TestConnectionResponse> {
  const response = await fetch(`${BASE_URL}/api/connections/azure/test`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON returned from azure connection test");
  }
}

export async function getAwsConnectionTest(): Promise<TestConnectionResponse> {
  const response = await fetch(`${BASE_URL}/api/connections/aws/test`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON returned from aws connection test");
  }
}

export interface ConnectionStatusResponse {
  provider: string;
  status: string;
  connected: boolean;
  message: string;
}

export async function getDockerConnectionStatus(): Promise<ConnectionStatusResponse> {
  const response = await fetch(`${BASE_URL}/api/connections/docker/status`);
  return response.json();
}

export async function getK8sConnectionStatus(): Promise<ConnectionStatusResponse> {
  const response = await fetch(`${BASE_URL}/api/connections/kubernetes/status`);
  return response.json();
}

export async function getAzureConnectionStatus(): Promise<ConnectionStatusResponse> {
  const response = await fetch(`${BASE_URL}/api/connections/azure/status`);
  return response.json();
}

export async function getAwsConnectionStatus(): Promise<ConnectionStatusResponse> {
  const response = await fetch(`${BASE_URL}/api/connections/aws/status`);
  return response.json();
}



