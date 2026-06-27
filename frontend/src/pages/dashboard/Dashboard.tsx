import { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Cpu, 
  Activity, 
  ShieldAlert, 
  Brain, 
  DollarSign,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Server,
  Layers,
  Database,
  HardDrive,
  Network,
  X,
  Info,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

import GradientHero from '../../components/GradientHero';
import MetricCard from '../../components/MetricCard';
import AgentCard from '../../components/AgentCard';
import IncidentTable, { Incident } from '../../components/IncidentTable';
import ActivityTimeline from '../../components/ActivityTimeline';

import {
  getMetrics,
  getIncidents,
  getAgents,
  getResources,
  getSecurity,
  getMemory,
  getCosts,
  investigateIncident,
  MetricsResponse,
  AgentResponseItem,
  ResourceItem,
  SecurityResponse,
  MemoryResponse,
  CostsResponse,
  AIInvestigateResponse,
  ApiError,
  searchMemory,
  getRecentInvestigations,
  HistoricalInvestigation,
  GroupedInvestigation,
  getDockerStatus,
  DockerStatus,
  getK8sStatus,
  K8sStatus,
  reconnectK8s,
  getHistoricalMetrics,
  HistoricalMetricData,
  getPrometheusStatus,
  PrometheusStatus,
  getSecurityScore,
  SecurityScoreResponse
} from '../../services/api';
import { formatFriendlyTimestamp } from '../../utils/dateFormatter';

interface ServiceUnavailableProps {
  title: string;
  reason: string;
  onRetry: () => void;
}

function ServiceUnavailable({ title, reason, onRetry }: ServiceUnavailableProps) {
  return (
    <div className="bg-white border border-brand-danger/20 rounded-2xl p-5 shadow-soft hover:shadow-premium transition-all duration-300 flex flex-col justify-between min-h-[160px] group">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-rose-50 text-brand-danger group-hover:bg-brand-danger/10 transition-colors duration-300">
          <AlertTriangle size={20} className="animate-pulse" />
        </div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-800 tracking-wide uppercase">
            {title} Unavailable
          </h4>
          <p className="text-xs text-brand-danger font-medium leading-relaxed">
            Reason: {reason}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-4 pt-3 border-t border-slate-50">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
            <span className="w-1.5 h-1.5 bg-brand-primary rounded-full" />
            Retry Connection
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
            <span className="w-1.5 h-1.5 bg-brand-primary rounded-full" />
            Verify Backend
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-700">
            <span className="w-1.5 h-1.5 bg-brand-primary rounded-full" />
            Check Database
          </span>
        </div>
        <button
          onClick={onRetry}
          className="px-3.5 py-1.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-lg text-xs shadow-soft transition-all active:scale-95 flex items-center gap-1"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

function IncidentsUnavailable({ reason, onRetry }: { reason: string; onRetry: () => void }) {
  return (
    <div className="bg-white border border-brand-danger/25 rounded-2xl p-6 shadow-soft hover:shadow-premium transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between min-h-[140px] gap-6">
      <div className="flex items-start gap-4 flex-1">
        <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-500">
          <AlertTriangle size={24} className="animate-pulse" />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-extrabold text-slate-900 text-sm tracking-tight">Incidents List Unavailable</h3>
          <p className="text-xs text-brand-danger font-semibold">Reason: {reason}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <span className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
              <span className="w-1.5 h-1.5 bg-brand-primary rounded-full" />
              Retry Connection
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
              <span className="w-1.5 h-1.5 bg-brand-primary rounded-full" />
              Verify Backend
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
              <span className="w-1.5 h-1.5 bg-brand-primary rounded-full" />
              Check Database
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={onRetry}
        className="px-4.5 py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl text-xs shadow-soft transition-all active:scale-95 flex items-center gap-1.5 self-start sm:self-center"
      >
        Retry Connection
      </button>
    </div>
  );
}

// Live chart data for System Health / Load trend is fetched dynamically from database.

const incidentDetailsLookup: Record<string, { source: string; time: string }> = {
  'CPU Spike': { source: 'kube-us-east-cluster', time: '3 mins ago' },
  'Memory Exhaustion': { source: 'rds-aurora-postgres', time: '24 mins ago' },
  'TLS Certificate Expiring': { source: 'cert-manager-production', time: '4 hours ago' },
  'K8s Cluster node memory exhaustion': { source: 'kube-us-east-cluster', time: '3 mins ago' },
  'DB Write Latency anomaly spike': { source: 'rds-aurora-postgres', time: '24 mins ago' },
  'API response code 502 Bad Gateway': { source: 'ingress-nginx-controller', time: '1 hour ago' },
  'SSL/TLS Certificate expiring in 15 days': { source: 'cert-manager-production', time: '4 hours ago' }
};

const agentDetailsLookup: Record<string, { role: string; lastActivity: string; progress: number; health: 'healthy' | 'warning' | 'critical' }> = {
  'Security Agent': {
    role: 'Vulnerability & IAM',
    lastActivity: 'TLS certificate audits',
    progress: 90,
    health: 'healthy',
  },
  'Memory Agent': {
    role: 'Platform Knowledge Sync',
    lastActivity: 'Updating failure runbook log',
    progress: 54,
    health: 'healthy',
  },
  'Cost Agent': {
    role: 'FinOps & Scaling Limits',
    lastActivity: 'Compiled resource savings report',
    progress: 100,
    health: 'healthy',
  },
  'Architect Agent': {
    role: 'Infrastructure Blueprint',
    lastActivity: 'Synced infra state model',
    progress: 100,
    health: 'healthy',
  },
  'Investigator Agent': {
    role: 'Root Cause Diagnosis',
    lastActivity: 'Mitigating CPU thread lock',
    progress: 78,
    health: 'healthy',
  },
  'Reliability Agent': {
    role: 'Self-Healing Recovery',
    lastActivity: 'Scaling replica cluster limits',
    progress: 82,
    health: 'healthy',
  },
  'Performance Agent': {
    role: 'Latency & Resource Profiling',
    lastActivity: 'Spike detected on Route-Ingress',
    progress: 100,
    health: 'warning',
  },
};

export default function Dashboard() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [agents, setAgents] = useState<AgentResponseItem[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [securityScore, setSecurityScore] = useState<SecurityScoreResponse | null>(null);
  const [securityScoreError, setSecurityScoreError] = useState<string | null>(null);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);
  const [security, setSecurity] = useState<SecurityResponse | null>(null);
  const [memory, setMemory] = useState<MemoryResponse | null>(null);
  const [costs, setCosts] = useState<CostsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Historical trend metrics states
  const [performanceData, setPerformanceData] = useState<HistoricalMetricData[]>([]);
  const [metricsType, setMetricsType] = useState<'docker' | 'kubernetes' | 'prometheus'>('docker');
  const [prometheusStatus, setPrometheusStatus] = useState<PrometheusStatus | null>(null);

  // Localized service error states
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [costsError, setCostsError] = useState<string | null>(null);
  const [recentInvestigationsError, setRecentInvestigationsError] = useState<string | null>(null);

  // AI Incident Investigator States
  const [aiIncident, setAiIncident] = useState<string>('');
  const [aiSeverity, setAiSeverity] = useState<string>('High');
  const [aiLogs, setAiLogs] = useState<string>('');
  const [aiResult, setAiResult] = useState<AIInvestigateResponse | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Memory Recall and Widgets States
  const [recentInvestigations, setRecentInvestigations] = useState<GroupedInvestigation[]>([]);
  const [expandedIncidents, setExpandedIncidents] = useState<Record<string, boolean>>({});

  const toggleIncidentExpand = (incidentId: string) => {
    setExpandedIncidents((prev) => ({
      ...prev,
      [incidentId]: !prev[incidentId],
    }));
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dockerStatus, setDockerStatus] = useState<DockerStatus | null>(null);
  const [k8sStatus, setK8sStatus] = useState<K8sStatus | null>(null);
  const [reconnectingK8s, setReconnectingK8s] = useState<boolean>(false);

  const handleK8sReconnect = async () => {
    try {
      setReconnectingK8s(true);
      const res = await reconnectK8s();
      if (res.status === 'success') {
        const updatedStatus = await getK8sStatus();
        setK8sStatus(updatedStatus);
      }
    } catch (err: any) {
      console.error('Failed to reconnect K8s:', err);
    } finally {
      setReconnectingK8s(false);
    }
  };
  const [searchResults, setSearchResults] = useState<HistoricalInvestigation[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const fetchDashboardData = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }


    const promises = [
      (async () => {
        try {
          const res = await getHistoricalMetrics(metricsType);
          setPerformanceData(res.data || []);
        } catch (err: any) {
          console.error('Error fetching historical metrics:', err);
        }
      })(),

      (async () => {
        try {
          const res = await getMetrics();
          setMetrics(res);
          setMetricsError(null);
        } catch (err: any) {
          console.error('Error fetching metrics:', err);
          setMetricsError(err.message || 'Metrics Unavailable');
        }
      })(),

      (async () => {
        try {
          const res = await getIncidents();
          const mappedIncidents: Incident[] = res.data.map((inc) => {
            const lookup = incidentDetailsLookup[inc.title];
            return {
              id: String(inc.id),
              incident_code: inc.incident_code,
              name: inc.title,
              severity: (inc.severity.toLowerCase() as Incident['severity']) || 'low',
              status: (inc.status.toLowerCase() as Incident['status']) || 'open',
              source: lookup?.source || 'system-monitor',
              time: formatFriendlyTimestamp(inc.last_seen || inc.time),
              occurrence_count: inc.occurrence_count
            };
          });
          setIncidents(mappedIncidents);
          setIncidentsError(null);
        } catch (err: any) {
          console.error('Error fetching incidents:', err);
          setIncidentsError(err.message || 'Incidents Unavailable');
        }
      })(),

      (async () => {
        try {
          const res = await getAgents();
          setAgents(res.data);
          setAgentsError(null);
        } catch (err: any) {
          console.error('Error fetching agents:', err);
          setAgentsError(err.message || 'Agents Unavailable');
        }
      })(),

      (async () => {
        try {
          const res = await getResources();
          setResources(res.data);
          setResourcesError(null);
        } catch (err: any) {
          console.error('Error fetching resources:', err);
          setResourcesError(err.message || 'Resources Unavailable');
        }
      })(),



      (async () => {
        try {
          const res = await getSecurity();
          setSecurity(res);
        } catch (err: any) {
          console.error('Error fetching security:', err);
        }
      })(),

      (async () => {
        try {
          const res = await getSecurityScore();
          setSecurityScore(res);
          setSecurityScoreError(null);
        } catch (err: any) {
          console.error('Error fetching security score:', err);
          setSecurityScoreError(err.message || 'Security Score Unavailable');
        }
      })(),

      (async () => {
        try {
          const res = await getMemory();
          setMemory(res);
          setMemoryError(null);
        } catch (err: any) {
          console.error('Error fetching memory:', err);
          setMemoryError(err.message || 'Memory Status Unavailable');
        }
      })(),

      (async () => {
        try {
          const res = await getCosts();
          setCosts(res);
          setCostsError(null);
        } catch (err: any) {
          console.error('Error fetching costs:', err);
          setCostsError(err.message || 'Costs Status Unavailable');
        }
      })(),

      (async () => {
        try {
          const res = await getRecentInvestigations();
          setRecentInvestigations(res.data || []);
          setRecentInvestigationsError(null);
        } catch (err: any) {
          console.error('Error fetching recent investigations:', err);
          setRecentInvestigationsError(err.message || 'Recent Investigations Unavailable');
        }
      })(),
    ];

    await Promise.all(promises);

    // Fetch Docker Engine status safely so Docker errors do not block dashboard load
    try {
      const dockerRes = await getDockerStatus();
      setDockerStatus(dockerRes);
    } catch (dockerErr) {
      console.error('Error fetching initial Docker status:', dockerErr);
      setDockerStatus({ connected: false, error: 'Docker Engine not running' });
    }

    // Fetch Kubernetes status safely
    try {
      const k8sRes = await getK8sStatus();
      setK8sStatus(k8sRes);
    } catch (k8sErr) {
      console.error('Error fetching initial K8s status:', k8sErr);
      setK8sStatus({ connected: false, error: 'Kubernetes Cluster unavailable' });
    }

    // Fetch Prometheus status safely
    try {
      const promRes = await getPrometheusStatus();
      setPrometheusStatus(promRes);
    } catch (promErr) {
      console.error('Error fetching initial Prometheus status:', promErr);
      setPrometheusStatus({ connected: false, activeAlerts: 0, metricsCount: 0, error: 'Prometheus server offline' });
    }

    if (showLoading) {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch historical metrics when toggle changes
    const fetchTrend = async () => {
      try {
        const res = await getHistoricalMetrics(metricsType);
        setPerformanceData(res.data || []);
      } catch (err: any) {
        console.error('Error fetching historical metrics:', err);
      }
    };
    fetchTrend();
  }, [metricsType]);

  useEffect(() => {
    fetchDashboardData(true);

    // Auto refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      fetchDashboardData(false);
    }, 30000);

    // Poll Docker, K8s, & Prometheus status every 20 seconds
    const interval = setInterval(async () => {
      try {
        const res = await getDockerStatus();
        setDockerStatus(res);
      } catch (err) {
        console.error('Error polling Docker status:', err);
        setDockerStatus({ connected: false, error: 'Docker Engine not running' });
      }

      try {
        const res = await getK8sStatus();
        setK8sStatus(res);
      } catch (err) {
        console.error('Error polling K8s status:', err);
        setK8sStatus({ connected: false, error: 'Kubernetes Cluster unavailable' });
      }

      try {
        const res = await getPrometheusStatus();
        setPrometheusStatus(res);
      } catch (err) {
        console.error('Error polling Prometheus status:', err);
        setPrometheusStatus({ connected: false, activeAlerts: 0, metricsCount: 0, error: 'Prometheus server offline' });
      }
    }, 20000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(interval);
    };
  }, []);

  const handleAIInvestigate = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiIncident.trim()) return;

    try {
      setAiLoading(true);
      setAiError(null);
      setAiResult(null);

      // Generate sequential logs with actual current time
      const now = new Date();
      const formatTime = (d: Date) => {
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        return `[${hh}:${mm}:${ss}]`;
      };
      
      const t1 = new Date(now.getTime());
      const t2 = new Date(now.getTime() + 2000);
      const t3 = new Date(now.getTime() + 4000);
      const t4 = new Date(now.getTime() + 6000);
      const t5 = new Date(now.getTime() + 9000);

      const newLogs = [
        `${formatTime(t1)} Investigation started`,
        `${formatTime(t2)} Parsing logs`,
        `${formatTime(t3)} Running AI root-cause analysis`,
        `${formatTime(t4)} Generating remediation plan`,
        `${formatTime(t5)} Investigation completed`
      ];

      localStorage.setItem('investigator_logs', JSON.stringify(newLogs));

      const result = await investigateIncident({
        incident: aiIncident,
        severity: aiSeverity,
        logs: aiLogs,
      });
      setAiResult(result);
    } catch (err: any) {
      console.error(err);
      if (err instanceof ApiError) {
        if (err.status && err.status !== 0) {
          setAiError(`Error [${err.status}]: ${err.message}`);
        } else {
          setAiError(err.message);
        }
      } else {
        setAiError(err.message || 'Unable to reach AegisAI-X backend');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearchMemory = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setSearchLoading(true);
      setSearchError(null);
      const res = await searchMemory(searchQuery);
      setSearchResults(res.data || []);
    } catch (err: any) {
      console.error(err);
      if (err instanceof ApiError) {
        setSearchError(`Error [${err.status}]: ${err.message}`);
      } else {
        setSearchError(err.message || 'Failed to search memory');
      }
    } finally {
      setSearchLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-brand-textSecondary animate-pulse">Loading AegisAI-X dashboard data...</p>
      </div>
    );
  }



  // Calculate active incidents
  const activeIncidentsCount = incidents.filter(i => i.status !== 'resolved').length;

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <GradientHero />

      {/* Docker Engine Connection Status Banner */}
      <section className="bg-white border border-slate-100 rounded-3xl p-6 shadow-soft hover:shadow-premium transition-all duration-300 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/5 to-cyan-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-2xl ${dockerStatus?.connected ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-500'} transition-all duration-300`}>
              <Server size={24} className={dockerStatus?.connected ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="font-extrabold text-slate-900 text-base">Docker Engine</h3>
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  dockerStatus?.connected 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                    : 'bg-rose-50 text-rose-600 border-rose-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dockerStatus?.connected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                  <span>{dockerStatus?.connected ? 'Connected' : 'Disconnected'}</span>
                </span>
              </div>
              <p className="text-xs text-brand-textSecondary mt-0.5">
                {dockerStatus?.connected 
                  ? `Active Host (v${dockerStatus.engineVersion}) • Live SRE infrastructure monitoring`
                  : dockerStatus?.error || 'Docker Engine offline or not running'
                }
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center gap-4 lg:gap-8">
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[100px] lg:min-w-[120px] transition-all hover:bg-slate-50">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Layers size={13} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Containers</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {dockerStatus?.connected ? dockerStatus.containers : '—'}
              </div>
            </div>

            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[100px] lg:min-w-[120px] transition-all hover:bg-slate-50">
              <div className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Running</span>
              </div>
              <div className="text-xl font-extrabold text-emerald-600 mt-1">
                {dockerStatus?.connected ? dockerStatus.running : '—'}
              </div>
            </div>

            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[100px] lg:min-w-[120px] transition-all hover:bg-slate-50">
              <div className="flex items-center gap-1.5 text-rose-500">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Stopped</span>
              </div>
              <div className="text-xl font-extrabold text-rose-500 mt-1">
                {dockerStatus?.connected ? dockerStatus.stopped : '—'}
              </div>
            </div>

            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[100px] lg:min-w-[120px] transition-all hover:bg-slate-50">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Database size={13} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Images</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {dockerStatus?.connected ? dockerStatus.images : '—'}
              </div>
            </div>

            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[100px] lg:min-w-[120px] transition-all hover:bg-slate-50">
              <div className="flex items-center gap-1.5 text-slate-500">
                <HardDrive size={13} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Volumes</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {dockerStatus?.connected ? dockerStatus.volumes : '—'}
              </div>
            </div>

            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[100px] lg:min-w-[120px] transition-all hover:bg-slate-50">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Network size={13} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Networks</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {dockerStatus?.connected ? dockerStatus.networks : '—'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kubernetes Cluster Connection Status Banner */}
      <section className="bg-white border border-slate-100 rounded-3xl p-6 shadow-soft hover:shadow-premium transition-all duration-300 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-500/5 to-purple-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className={`p-3.5 rounded-2xl ${
              k8sStatus?.connected 
                ? 'bg-indigo-50 text-indigo-600' 
                : k8sStatus?.status === 'unavailable' 
                  ? 'bg-rose-50 text-rose-500' 
                  : 'bg-slate-50 text-slate-400'
            } transition-all duration-300`}>
              <Network size={24} className={k8sStatus?.connected ? 'animate-pulse' : ''} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <h3 className="font-extrabold text-slate-900 text-base">Kubernetes Cluster</h3>
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  k8sStatus?.connected 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                    : k8sStatus?.status === 'unavailable'
                      ? 'bg-rose-50 text-rose-600 border-rose-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    k8sStatus?.connected 
                      ? 'bg-emerald-500 animate-ping' 
                      : k8sStatus?.status === 'unavailable'
                        ? 'bg-rose-500'
                        : 'bg-slate-400'
                  }`} />
                  <span>{
                    k8sStatus?.connected 
                      ? 'Connected' 
                      : k8sStatus?.status === 'unavailable'
                        ? 'Unavailable'
                        : 'Disconnected'
                  }</span>
                </span>
              </div>
              
              {k8sStatus?.connected ? (
                <p className="text-xs text-brand-textSecondary mt-0.5 truncate">
                  Active Cluster Context: {k8sStatus.cluster} (v{k8sStatus.version}) • Orchestrating production resources
                </p>
              ) : k8sStatus?.status === 'unavailable' ? (
                <div className="mt-1 space-y-1.5">
                  <p className="text-xs font-semibold text-rose-600">
                    Reason: <span className="font-mono bg-rose-50 px-1 py-0.5 rounded text-[11px]">{k8sStatus.reason}</span>
                  </p>
                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1 font-medium">
                    <span className="font-bold text-slate-600 uppercase text-[9px] tracking-wider block w-full sm:w-auto">Actions:</span>
                    <span>• Verify Docker Desktop is running</span>
                    <span>• Restart Minikube</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-brand-textSecondary mt-0.5">
                  {k8sStatus?.error || 'Kubernetes Cluster offline or unreachable'}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 flex-shrink-0">
            {!k8sStatus?.connected && (
              <button
                onClick={handleK8sReconnect}
                disabled={reconnectingK8s}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all duration-200 shadow-soft active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5"
              >
                {reconnectingK8s ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Reconnecting...</span>
                  </>
                ) : (
                  <span>Retry Connection</span>
                )}
              </button>
            )}

            {k8sStatus?.connected && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center gap-4 lg:gap-8">
                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[100px] lg:min-w-[120px] transition-all hover:bg-slate-50">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Server size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Nodes</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">
                    {k8sStatus.nodes}
                  </div>
                </div>

                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[100px] lg:min-w-[120px] transition-all hover:bg-slate-50">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Layers size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Pods</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">
                    {k8sStatus.pods}
                  </div>
                </div>

                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[100px] lg:min-w-[120px] transition-all hover:bg-slate-50">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Database size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Deployments</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">
                    {k8sStatus.deployments}
                  </div>
                </div>

                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[100px] lg:min-w-[120px] transition-all hover:bg-slate-50">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Network size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Services</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">
                    {k8sStatus.services}
                  </div>
                </div>

                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[100px] lg:min-w-[120px] transition-all hover:bg-slate-50">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <HardDrive size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Namespaces</span>
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">
                    {k8sStatus.namespaces}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Prometheus Observability Connection Status Banner */}
      <Link to="/prometheus" className="block">
        <section className="bg-white border border-slate-100 rounded-3xl p-6 shadow-soft hover:shadow-premium transition-all duration-300 relative overflow-hidden group cursor-pointer">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-orange-500/5 to-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4 flex-1">
              <div className={`p-3.5 rounded-2xl ${
                prometheusStatus?.connected 
                  ? 'bg-orange-50 text-orange-600' 
                  : 'bg-rose-50 text-rose-500'
              } transition-all duration-300`}>
                <Activity size={24} className={prometheusStatus?.connected ? 'animate-pulse' : ''} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-extrabold text-slate-900 text-base group-hover:text-brand-primary transition-colors duration-300">Prometheus Observability</h3>
                  <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    prometheusStatus?.connected 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                      : 'bg-rose-50 text-rose-600 border-rose-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${prometheusStatus?.connected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                    <span>{prometheusStatus?.connected ? 'Connected' : 'Disconnected'}</span>
                  </span>
                </div>
                <p className="text-xs text-brand-textSecondary mt-0.5">
                  {prometheusStatus?.connected 
                    ? `Active Host (http://localhost:9090) • Dynamic query & AI SRE alerting engine active`
                    : prometheusStatus?.error || 'Prometheus server offline or unreachable'
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              {prometheusStatus?.connected && (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:flex lg:items-center gap-4 lg:gap-8">
                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[100px] lg:min-w-[120px] transition-all hover:bg-slate-50">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <AlertTriangle size={13} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Active Alerts</span>
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 mt-1">
                      {prometheusStatus.activeAlerts}
                    </div>
                  </div>

                  <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[100px] lg:min-w-[120px] transition-all hover:bg-slate-50">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Cpu size={13} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Metrics Count</span>
                    </div>
                    <div className="text-xl font-extrabold text-slate-900 mt-1">
                      {prometheusStatus.metricsCount}
                    </div>
                  </div>
                </div>
              )}
              <div className="p-2 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-all duration-300 ml-2">
                <ChevronRight size={18} />
              </div>
            </div>
          </div>
        </section>
      </Link>

      {/* Metrics Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
        <MetricCard
          title="Active Incidents"
          value={incidentsError ? 'Unavailable' : activeIncidentsCount}
          change={incidentsError ? 'API Error' : '+1 today'}
          changeType={incidentsError ? 'neutral' : 'negative'}
          chartColor="#EF4444"
          icon={<AlertTriangle size={18} className="text-brand-danger" />}
          chartData={[{ value: 1 }, { value: 2 }, { value: 1 }, { value: incidentsError ? 0 : activeIncidentsCount }]}
        />
        <MetricCard
          title="Active Agents"
          value={agentsError ? 'Unavailable' : `${agents.length} / ${agents.length}`}
          change={agentsError ? 'API Error' : 'All Healthy'}
          changeType={agentsError ? 'neutral' : 'positive'}
          chartColor="#10B981"
          icon={<Cpu size={18} className="text-brand-primary" />}
          chartData={[{ value: 3 }, { value: 3 }, { value: agentsError ? 0 : agents.length }]}
        />
        <MetricCard
          title="Infra Health"
          value={metricsError ? 'Unavailable' : (metrics ? `${metrics.data.success_rate.value}%` : '99.85%')}
          change={metricsError ? 'API Error' : '+0.02% vs yesterday'}
          changeType={metricsError ? 'neutral' : 'positive'}
          chartColor="#10B981"
          icon={<Activity size={18} className="text-brand-success" />}
          chartData={[{ value: 99.8 }, { value: 99.82 }, { value: metricsError ? 0 : (metrics ? metrics.data.success_rate.value : 99.85) }]}
        />
        {(() => {
          const score = securityScoreError ? 0 : (securityScore ? securityScore.score : 98);
          const grade = securityScoreError ? 'Error' : (securityScore ? securityScore.grade : 'Excellent');
          const env = securityScoreError ? 'Unknown' : (securityScore ? securityScore.environment : 'Development');
          const envCap = env.charAt(0).toUpperCase() + env.slice(1);
          let changeMsg = grade;
          let changeTypeVal: 'positive' | 'neutral' | 'negative' = 'positive';
          if (securityScoreError) {
            changeMsg = 'API Error';
            changeTypeVal = 'neutral';
          } else if (grade === 'Excellent') {
            changeMsg = `Excellent (${envCap})`;
            changeTypeVal = 'positive';
          } else if (grade === 'Good') {
            changeMsg = `Good (${envCap})`;
            changeTypeVal = 'positive';
          } else if (grade === 'Warning') {
            changeMsg = `Warning (${envCap})`;
            changeTypeVal = 'neutral';
          } else {
            changeMsg = `Critical (${envCap})`;
            changeTypeVal = 'negative';
          }
          return (
            <MetricCard
              title="Security Score"
              value={securityScoreError ? 'Unavailable' : `${score} / 100`}
              change={changeMsg}
              changeType={changeTypeVal}
              chartColor="#8B5CF6"
              icon={<ShieldAlert size={18} className="text-brand-secondary" />}
              chartData={[{ value: 95 }, { value: 96 }, { value: securityScoreError ? 0 : score }]}
              onClick={() => setIsSecurityModalOpen(true)}
            />
          );
        })()}
        <MetricCard
          title="Memory Nodes"
          value={memoryError ? 'Unavailable' : (memory ? memory.vector_db.total_nodes.toLocaleString() : '14,892')}
          change={memoryError ? 'API Error' : '+142 sync today'}
          changeType={memoryError ? 'neutral' : 'positive'}
          chartColor="#EC4899"
          icon={<Brain size={18} className="text-brand-accent" />}
          chartData={[{ value: 14600 }, { value: 14700 }, { value: memoryError ? 0 : (memory ? memory.vector_db.total_nodes : 14892) }]}
        />
        <MetricCard
          title="Cost Savings"
          value={costsError ? 'Unavailable' : (costs ? `$${costs.applied_savings_monthly.toLocaleString()}` : '$4,280')}
          change={costsError ? 'API Error' : '+$340 target limit'}
          changeType={costsError ? 'neutral' : 'positive'}
          chartColor="#10B981"
          icon={<DollarSign size={18} className="text-brand-success" />}
          chartData={[{ value: 3900 }, { value: 4000 }, { value: costsError ? 0 : (costs ? costs.applied_savings_monthly : 4280) }]}
        />
      </section>

      {/* Visual Analytics Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-5 shadow-soft">
          <div className="flex items-center justify-between pb-4 border-b border-slate-50 mb-5">
            <div>
              <h3 className="font-bold text-brand-textPrimary text-sm flex items-center gap-2">
                <TrendingUp size={16} className="text-brand-primary" />
                <span>Platform Load & Anomaly Signals ({metricsType === 'docker' ? 'Docker' : metricsType === 'kubernetes' ? 'Kubernetes' : 'Prometheus'})</span>
              </h3>
              <p className="text-xs text-brand-textSecondary">Metric comparisons during outage event mitigation</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-100 gap-1">
                <button
                  onClick={() => setMetricsType('docker')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                    metricsType === 'docker' 
                      ? 'bg-white text-brand-primary shadow-soft' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Docker
                </button>
                <button
                  onClick={() => setMetricsType('kubernetes')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                    metricsType === 'kubernetes' 
                      ? 'bg-white text-brand-primary shadow-soft' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Kubernetes
                </button>
                <button
                  onClick={() => setMetricsType('prometheus')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 ${
                    metricsType === 'prometheus' 
                      ? 'bg-white text-brand-primary shadow-soft' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Prometheus
                </button>
              </div>
              <span className="text-[10px] bg-slate-50 text-brand-textSecondary font-bold px-2.5 py-1.5 rounded-xl border border-slate-100">
                Live (UTC)
              </span>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5B5FFB" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#5B5FFB" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorAnomaly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFFFFF', 
                    border: '1px solid #E2E8F0', 
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                  }} 
                  formatter={(value: any, name: string) => {
                    const val = typeof value === 'number' ? value : parseFloat(value);
                    if (!isNaN(val)) {
                      if (name === "Anomaly Probability") {
                        const pctVal = val <= 1.0 ? val * 100 : val;
                        return [`${Number(pctVal.toFixed(2))}%`, name];
                      }
                      return [`${Number(val.toFixed(2))}%`, name];
                    }
                    return [value, name];
                  }}
                />
                <Area type="monotone" dataKey="load" stroke="#5B5FFB" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLoad)" name="Infra Load %" />
                <Area type="monotone" dataKey="anomalyProb" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorAnomaly)" name="Anomaly Probability" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-1">
          <ActivityTimeline />
        </div>
      </section>

      {/* Autonomous Agent Control Grid */}
      <section className="space-y-4">
        <div>
          <h3 className="font-bold text-brand-textPrimary text-base">Autonomous Intelligence Agents</h3>
          <p className="text-xs text-brand-textSecondary">State monitoring and individual agent workloads</p>
        </div>

        {agentsError ? (
          <ServiceUnavailable title="Agents" reason={agentsError} onRetry={() => fetchDashboardData(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-5">
            {agents.map((agent, index) => {
              const details = agentDetailsLookup[agent.name] || {
                role: 'Autonomous Operations',
                lastActivity: 'Monitoring logs and metrics',
                progress: 100,
                health: 'healthy' as const
              };
              
              let mappedStatus: 'idle' | 'active' | 'diagnosing' | 'paused' = 'active';
              const lowerStatus = agent.status.toLowerCase();
              if (lowerStatus === 'idle') {
                mappedStatus = 'idle';
              } else if (lowerStatus === 'paused') {
                mappedStatus = 'paused';
              } else if (lowerStatus === 'diagnosing') {
                mappedStatus = 'diagnosing';
              }

              return (
                <AgentCard
                  key={index}
                  name={agent.name}
                  role={details.role}
                  status={mappedStatus}
                  health={details.health}
                  lastActivity={details.lastActivity}
                  progress={details.progress}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Cloud Resources Section */}
      <section className="space-y-4">
        <div>
          <h3 className="font-bold text-brand-textPrimary text-base">Active Cloud Resources</h3>
          <p className="text-xs text-brand-textSecondary">Monitored cloud instances, databases, and container services</p>
        </div>

        {resourcesError ? (
          <ServiceUnavailable title="Resources" reason={resourcesError} onRetry={() => fetchDashboardData(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {resources.map((res, index) => (
              <div key={index} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft hover:shadow-premium transition-all duration-300 flex flex-col justify-between h-[130px] relative overflow-hidden group">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-slate-900 group-hover:text-brand-primary transition-colors duration-200 truncate max-w-[170px]">
                        {res.name}
                      </h4>
                      <span className="text-[10px] font-semibold text-brand-textSecondary uppercase tracking-wider block truncate max-w-[170px] mt-0.5">
                        {res.type}
                      </span>
                    </div>
                    <span className="text-[10px] bg-slate-50 text-brand-textSecondary font-bold px-2 py-0.5 rounded-lg border border-slate-100 flex-shrink-0">
                      {res.cloud}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                  <span className="text-[10px] text-brand-textSecondary font-semibold">Status</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      res.status === 'Running' || res.status === 'Healthy' || res.status === 'Available'
                        ? 'bg-brand-success animate-pulse'
                        : 'bg-brand-warning'
                    }`} />
                    <span className="text-xs font-semibold text-brand-textPrimary">{res.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* AI Incident Investigator Section */}
      <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft space-y-4 animate-fade-in">
        <div>
          <h3 className="font-bold text-brand-textPrimary text-base flex items-center gap-2">
            <Sparkles size={18} className="text-brand-primary animate-pulse" />
            <span>AI Incident Investigator</span>
          </h3>
          <p className="text-xs text-brand-textSecondary">
            Run automated, agent-driven root-cause analysis, system impact audits, and remediation steps.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inputs Column */}
          <form onSubmit={handleAIInvestigate} className="space-y-4 lg:col-span-1 border-r border-slate-50 lg:pr-6">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-brand-textSecondary uppercase">Incident Title</label>
              <input
                type="text"
                placeholder="e.g. CPU Spike on order-service pod"
                value={aiIncident}
                onChange={(e) => setAiIncident(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:border-brand-primary rounded-xl"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-brand-textSecondary uppercase">Severity</label>
              <select
                value={aiSeverity}
                onChange={(e) => setAiSeverity(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 bg-white text-slate-700 outline-none focus:border-brand-primary rounded-xl cursor-pointer"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-brand-textSecondary uppercase">Logs / Diagnostics Context</label>
              <textarea
                placeholder="Paste stack traces, container log lines, or error dumps here..."
                value={aiLogs}
                onChange={(e) => setAiLogs(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 text-xs border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:border-brand-primary rounded-xl font-mono"
                required
              />
            </div>

            <button
              type="submit"
              disabled={aiLoading}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-primary text-white hover:bg-brand-primary/95 shadow-soft transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Sparkles size={14} />
              <span>{aiLoading ? 'AI Investigator is analyzing incident...' : 'Analyze Incident'}</span>
            </button>
          </form>

          {/* Results/State Column */}
          <div className="lg:col-span-2 flex flex-col justify-center min-h-[220px]">
            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-semibold text-brand-textSecondary animate-pulse">
                  AI Investigator is analyzing incident...
                </p>
              </div>
            )}

            {aiError && (
              <div className="p-4 bg-red-50/50 border border-brand-danger/20 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-brand-danger">
                  <AlertTriangle size={16} />
                  <span className="text-xs font-bold">{aiError}</span>
                </div>
                <button 
                  onClick={(e) => handleAIInvestigate(e)}
                  className="px-3 py-1.5 text-[10px] font-bold text-white bg-brand-danger hover:bg-brand-danger/95 rounded-lg transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            )}

            {!aiLoading && !aiError && !aiResult && (
              <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl p-6">
                <Brain size={36} className="text-slate-200 mb-2 stroke-[1.5]" />
                <h4 className="text-xs font-bold text-slate-800">Awaiting Incident Data</h4>
                <p className="text-[10px] text-brand-textSecondary max-w-sm mt-1">
                  Fill in the incident details and click the analysis button to initiate our AI-driven root cause and remediation loop.
                </p>
              </div>
            )}

            {!aiLoading && !aiError && aiResult && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider">Summary</h4>
                  <div className="p-3 bg-brand-primary/5 border border-brand-primary/10 rounded-xl">
                    <p className="text-xs font-medium text-brand-textPrimary leading-relaxed">
                      {aiResult.summary}
                    </p>
                  </div>
                </div>

                {/* Root Cause & Impact side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <h5 className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider">Root Cause</h5>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl h-full">
                      <p className="text-xs text-brand-textPrimary leading-relaxed font-medium">
                        {aiResult.rootCause}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h5 className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider">Impact</h5>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl h-full">
                      <p className="text-xs text-brand-textPrimary leading-relaxed font-medium">
                        {aiResult.impact}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="space-y-1.5">
                  <h5 className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider">Recommendations</h5>
                  <ul className="space-y-1.5">
                    {aiResult.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs font-medium text-brand-textPrimary">
                        <span className="w-1.5 h-1.5 bg-brand-success rounded-full mt-1.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* AI & Infrastructure Memory Recall Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Memory Search Widget */}
        <div className="lg:col-span-1 bg-white border border-slate-100 rounded-2xl p-5 shadow-soft space-y-4">
          <div>
            <h3 className="font-bold text-brand-textPrimary text-base flex items-center gap-2">
              <Brain size={18} className="text-brand-accent animate-pulse" />
              <span>Infrastructure Memory Search</span>
            </h3>
            <p className="text-xs text-brand-textSecondary">
              Recall historical context and resolutions for active system failures.
            </p>
          </div>

          <form onSubmit={handleSearchMemory} className="flex gap-2">
            <input
              type="text"
              placeholder="Query historical logs (e.g. CPU Spike)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:border-brand-primary rounded-xl"
              required
            />
            <button
              type="submit"
              disabled={searchLoading}
              className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50"
            >
              Search
            </button>
          </form>

          {/* Search Results Display */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {searchLoading && (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            {searchError && (
              <p className="text-xs text-brand-danger font-medium">{searchError}</p>
            )}
            {!searchLoading && !searchError && searchResults.length === 0 && searchQuery && (
              <p className="text-xs text-brand-textSecondary text-center py-2">No matching SRE memory fragments found.</p>
            )}
            {!searchLoading && searchResults.map((result) => (
              <div key={result.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 hover:border-brand-primary/30 transition-all">
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-bold text-brand-textPrimary">{result.incident_title}</h4>
                  <span className="text-[9px] bg-brand-primary/10 text-brand-primary font-bold px-1.5 py-0.5 rounded-lg">
                    {result.incident_id}
                  </span>
                </div>
                <p className="text-[11px] text-brand-textSecondary leading-relaxed">{result.summary}</p>
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[9px] font-bold text-brand-textSecondary uppercase tracking-wider block mb-1">RCA & Recommendations:</span>
                  <p className="text-[10px] text-brand-textPrimary font-medium mb-1">{result.root_cause}</p>
                  <ul className="space-y-0.5">
                    {result.recommendations.map((rec, rIdx) => (
                      <li key={rIdx} className="text-[10px] text-brand-success font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-brand-success rounded-full mt-1 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Investigations History & AI Insights */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-5 shadow-soft space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-50">
            <div>
              <h3 className="font-bold text-brand-textPrimary text-base flex items-center gap-2">
                <Sparkles size={18} className="text-brand-success" />
                <span>Recent Investigations & AI Insights</span>
              </h3>
              <p className="text-xs text-brand-textSecondary">
                Audit trail and cognitive feedback from Gemini-assisted SRE diagnostics.
              </p>
            </div>
            <span className="text-[10px] bg-slate-50 border border-slate-100 text-brand-textSecondary font-bold px-2 py-0.5 rounded-lg">
              Historical Memory
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Recent Investigations History list */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider">Investigation History</h4>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {recentInvestigationsError ? (
                  <p className="text-xs text-brand-danger py-4 text-center font-medium">Unavailable: {recentInvestigationsError}</p>
                ) : recentInvestigations.length === 0 ? (
                  <p className="text-xs text-brand-textSecondary py-4 text-center">No historical investigations found.</p>
                ) : (
                  recentInvestigations.map((group) => {
                    const isExpanded = !!expandedIncidents[group.incidentId];
                    return (
                      <div key={group.incidentId} className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-2 hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] bg-brand-primary/10 text-brand-primary font-bold px-1.5 py-0.5 rounded">
                                {group.incidentId}
                              </span>
                              <span className="text-xs font-bold text-brand-textPrimary truncate max-w-[150px]">{group.title}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[9px] text-brand-textSecondary font-semibold">
                              <span>{group.occurrences} {group.occurrences === 1 ? 'Occurrence' : 'Occurrences'}</span>
                              <span>•</span>
                              <span>Last: {formatFriendlyTimestamp(group.lastInvestigated)}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleIncidentExpand(group.incidentId)}
                          className="w-full flex items-center justify-between py-1 px-2.5 bg-white border border-slate-100 rounded-lg hover:border-brand-primary/20 text-[9px] font-bold text-brand-textSecondary hover:text-brand-primary transition-all"
                        >
                          <span>{isExpanded ? 'Hide Timeline' : 'View Investigation Timeline'}</span>
                          {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>

                        {isExpanded && (
                          <div className="pl-2 border-l-2 border-brand-primary/20 space-y-3 pt-1.5 ml-1">
                            {group.investigations.map((inv, idx) => (
                              <div key={inv.id} className="space-y-1 text-[10px]">
                                <div className="flex justify-between items-center font-bold text-[9px]">
                                  <span className="text-brand-textPrimary">Investigation #{group.investigations.length - idx}</span>
                                  <span className="text-brand-textSecondary">{formatFriendlyTimestamp(inv.timestamp)}</span>
                                </div>
                                <p className="text-brand-textSecondary leading-relaxed">{inv.summary}</p>
                                <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] font-bold">
                                  <span className="text-brand-danger">RCA: {inv.rootCause}</span>
                                  {inv.recommendations.length > 0 && (
                                    <span className="text-brand-success">• Recommendations: {inv.recommendations.length}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* AI Insights & Top Recommendations */}
            <div className="space-y-3 bg-brand-primary/[0.02] border border-brand-primary/5 rounded-2xl p-4">
              <h4 className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-brand-primary" />
                <span>AI Insights & Top Recommendations</span>
              </h4>
              <div className="space-y-3">
                {recentInvestigationsError ? (
                  <p className="text-xs text-brand-danger py-4 text-center font-medium">Unavailable: {recentInvestigationsError}</p>
                ) : recentInvestigations.length === 0 ? (
                  <p className="text-xs text-brand-textSecondary py-4 text-center">Awaiting data to compile recommendations.</p>
                ) : (
                  <>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-brand-textSecondary uppercase block">Latest Discovery:</span>
                      <p className="text-xs font-medium text-brand-textPrimary leading-relaxed">
                        {recentInvestigations[0].investigations[0]?.rootCause || 'N/A'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-brand-textSecondary uppercase block">Remediation Blueprint:</span>
                      <ul className="space-y-1 mt-1">
                        {(recentInvestigations[0].investigations[0]?.recommendations || []).slice(0, 3).map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-xs text-brand-textPrimary font-medium">
                            <span className="w-1.5 h-1.5 bg-brand-success rounded-full mt-1.5 flex-shrink-0" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Incidents Table Section */}
      <section>
        {incidentsError ? (
          <IncidentsUnavailable reason={incidentsError} onRetry={() => fetchDashboardData(true)} />
        ) : (
          <IncidentTable incidents={incidents} />
        )}
      </section>

      {/* Security Score Breakdown Modal */}
      {isSecurityModalOpen && securityScore && (() => {
        const vulns = security?.vulnerabilities || [];
        const criticalCount = securityScore.critical;
        const highCount = securityScore.high;
        const mediumCount = securityScore.medium;
        const lowCount = securityScore.low;

        const privilegedCount = vulns.filter(v => v.cve === 'PRIV-CONTAINER' || v.cve === 'K8S-PRIV-CONTAINER').length;
        const rootCount = vulns.filter(v => v.cve === 'ROOT-USER' || v.cve === 'K8S-ROOT-USER').length;
        const latestCount = vulns.filter(v => v.cve === 'LATEST-TAG' || v.cve === 'K8S-LATEST-TAG').length;
        const hostPathCount = vulns.filter(v => v.cve === 'K8S-HOSTPATH-MOUNT').length;
        const limitsCount = vulns.filter(v => v.cve === 'K8S-MISSING-LIMITS').length;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-premium max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-slide-up">
              
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-violet-50 text-violet-600">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-950 text-lg">Security Posture Breakdown</h3>
                    <p className="text-xs text-slate-500 font-medium">Real-time infrastructure security validation</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSecurityModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                
                {/* Score Display Card */}
                <div className="bg-slate-950 text-white rounded-2xl p-6 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-violet-500/20 to-fuchsia-500/20 rounded-full blur-2xl pointer-events-none -mr-12 -mt-12" />
                  <div className="space-y-2 relative z-10">
                    <div className="flex gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-400 bg-violet-500/10 px-2.5 py-1 rounded-full border border-violet-500/25">
                        Security Posture
                      </span>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/25">
                        Environment: {securityScore.environment.charAt(0).toUpperCase() + securityScore.environment.slice(1)}
                      </span>
                    </div>
                    <h4 className="text-2xl font-black">{securityScore.grade}</h4>
                    <p className="text-xs text-slate-400 font-medium">
                      Last computed: {new Date(securityScore.lastUpdated).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="flex flex-col items-end">
                      <span className="text-3xl font-black tracking-tight text-white">{securityScore.score}<span className="text-lg text-slate-400">/100</span></span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Infrastructure Score</span>
                    </div>
                    {/* Visual score meter */}
                    <div className="w-16 h-16 rounded-full border-4 border-slate-800 flex items-center justify-center relative">
                      <span className={`absolute inset-1 rounded-full border-4 border-t-brand-primary border-r-brand-primary ${securityScore.score >= 75 ? 'border-b-brand-primary' : ''} ${securityScore.score >= 90 ? 'border-l-brand-primary' : ''} opacity-40`} />
                      <span className="text-xs font-black">{securityScore.score}%</span>
                    </div>
                  </div>
                </div>

                {/* Development adjustments note callout */}
                {securityScore.environment === 'development' && (
                  <div className="p-4 rounded-2xl bg-violet-50/50 border border-violet-100 flex items-start gap-3">
                    <Info size={16} className="text-violet-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <h5 className="text-xs font-extrabold text-violet-950 uppercase tracking-wider">Development Environment Adjustments Applied</h5>
                      <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                        {securityScore.reason}
                      </p>
                    </div>
                  </div>
                )}

                {/* Vulnerabilities Summary Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Vulnerabilities Summary</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
                      <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Critical</span>
                      <span className="text-2xl font-black text-rose-700">{criticalCount}</span>
                    </div>
                    <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
                      <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">High</span>
                      <span className="text-2xl font-black text-orange-700">{highCount}</span>
                    </div>
                    <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Medium</span>
                      <span className="text-2xl font-black text-amber-700">{mediumCount}</span>
                    </div>
                    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex flex-col justify-between min-h-[90px]">
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Low</span>
                      <span className="text-2xl font-black text-blue-700">{lowCount}</span>
                    </div>
                  </div>
                </div>

                {/* Configuration Audits Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Infrastructure Audits</h4>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                    <div className="p-3.5 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">Privileged Containers</span>
                      <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${privilegedCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{privilegedCount}</span>
                    </div>
                    <div className="p-3.5 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">Root Containers</span>
                      <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${rootCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{rootCount}</span>
                    </div>
                    <div className="p-3.5 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">Latest Tags</span>
                      <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${latestCount > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>{latestCount}</span>
                    </div>
                    <div className="p-3.5 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">HostPath Mounts</span>
                      <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${hostPathCount > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>{hostPathCount}</span>
                    </div>
                    <div className="p-3.5 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">Missing Resource Limits</span>
                      <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${limitsCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{limitsCount}</span>
                    </div>
                  </div>
                </div>

                {/* Breakdown list */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Score Explanations ({securityScore.breakdown.length})</h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    {securityScore.breakdown.map((item, idx) => {
                      return (
                        <div key={idx} className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg ${item.status === 'healthy' ? 'bg-emerald-50 text-emerald-600' : item.status === 'critical' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                              {item.status === 'healthy' ? (
                                <CheckCircle2 size={14} />
                              ) : (
                                <AlertTriangle size={14} />
                              )}
                            </div>
                            <span className="text-xs font-bold text-slate-700">{item.name}</span>
                          </div>
                          <span className={`text-xs font-extrabold font-mono ${item.points > 0 ? 'text-emerald-600' : item.points < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                            {item.points > 0 ? `+${item.points}` : item.points} pts
                          </span>
                        </div>
                      );
                    })}
                    {securityScore.breakdown.length === 0 && (
                      <p className="text-xs text-slate-500 font-medium text-center py-2">No security penalties detected. Perfect score!</p>
                    )}
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Info size={12} />
                  <span>Computed from K8s, Docker, Prometheus & Incident states</span>
                </p>
                <button
                  onClick={() => setIsSecurityModalOpen(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors"
                >
                  Close Breakdown
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
