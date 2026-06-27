import { useState, useEffect } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { 
  getPrometheusStatus, 
  queryRangePrometheus, 
  PrometheusStatus
} from '../../services/api';

// Components
import PrometheusStatusCard from '../../components/prometheus/PrometheusStatusCard';
import MetricsOverview from '../../components/prometheus/MetricsOverview';
import CpuTrendChart from '../../components/prometheus/CpuTrendChart';
import MemoryTrendChart from '../../components/prometheus/MemoryTrendChart';
import NetworkTrendChart from '../../components/prometheus/NetworkTrendChart';
import QueryConsole from '../../components/prometheus/QueryConsole';
import AlertsPanel from '../../components/prometheus/AlertsPanel';

interface ChartPoint {
  time: string;
  value: number;
}

interface NetPoint {
  time: string;
  ingress: number;
  egress: number;
}

export default function PrometheusDashboard() {
  const [status, setStatus] = useState<PrometheusStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Charts state
  const [cpuData, setCpuData] = useState<ChartPoint[]>([]);
  const [memData, setMemData] = useState<ChartPoint[]>([]);
  const [netData, setNetData] = useState<NetPoint[]>([]);
  const [restartData, setRestartData] = useState<ChartPoint[]>([]);
  const [deployHealthData, setDeployHealthData] = useState<ChartPoint[]>([]);

  const fetchRangeData = async (query: string, durationMin = 30): Promise<ChartPoint[]> => {
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - durationMin * 60000).toISOString();
    const step = '1m';

    try {
      const res = await queryRangePrometheus(query, startTime, endTime, step);
      if (res?.status === 'success' && res.data?.result?.[0]?.values) {
        return res.data.result[0].values.map((v: any) => {
          const t = new Date(v[0] * 1000);
          const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          return {
            time: timeStr,
            value: parseFloat(v[1]) || 0
          };
        });
      }
    } catch (e) {
      console.warn(`Failed to fetch range metrics for: ${query}`, e);
    }
    return [];
  };

  const loadDashboardData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);

    try {
      // 1. Fetch Status
      const statusRes = await getPrometheusStatus();
      setStatus(statusRes);

      if (statusRes.connected) {
        // 2. Fetch Prometheus real range metrics
        const cpuPoints = await fetchRangeData('avg(rate(container_cpu_usage_seconds_total{container!=""}[5m])) * 100');
        setCpuData(cpuPoints);

        const memPoints = await fetchRangeData('avg(container_memory_usage_bytes{container!=""}) / 1024 / 1024');
        setMemData(memPoints);

        // Network Ingress & Egress
        const netInPoints = await fetchRangeData('sum(rate(container_network_receive_bytes_total[5m])) / 1024');
        const netOutPoints = await fetchRangeData('sum(rate(container_network_transmit_bytes_total[5m])) / 1024');

        const mergedNet: NetPoint[] = [];
        const length = Math.max(netInPoints.length, netOutPoints.length);
        for (let i = 0; i < length; i++) {
          const pIn = netInPoints[i] || { time: '', value: 0 };
          const pOut = netOutPoints[i] || { time: '', value: 0 };
          mergedNet.push({
            time: pIn.time || pOut.time,
            ingress: pIn.value,
            egress: pOut.value
          });
        }
        setNetData(mergedNet);

        // Pod Restarts
        const restartPoints = await fetchRangeData('sum(kube_pod_container_status_restarts_total)');
        setRestartData(restartPoints);

        // Deployment Health
        const deployPoints = await fetchRangeData('sum(kube_deployment_status_replicas_ready) / sum(kube_deployment_status_replicas) * 100');
        setDeployHealthData(deployPoints);
      } else {
        // Fallback: Populate with mock data for graceful degradation
        loadMockData();
      }
    } catch (err) {
      console.error('Failed to load Prometheus dashboard data:', err);
      setStatus({
        connected: false,
        activeAlerts: 0,
        metricsCount: 0,
        error: 'Failed to connect to AegisAI-X backend API'
      });
      loadMockData();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMockData = () => {
    const now = Date.now();
    const mockCpu: ChartPoint[] = [];
    const mockMem: ChartPoint[] = [];
    const mockNet: NetPoint[] = [];
    const mockRestart: ChartPoint[] = [];
    const mockDeploy: ChartPoint[] = [];

    for (let i = 30; i >= 0; i--) {
      const t = new Date(now - i * 60000);
      const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      mockCpu.push({ time: timeStr, value: 30 + Math.random() * 20 });
      mockMem.push({ time: timeStr, value: 512 + Math.random() * 100 });
      mockNet.push({
        time: timeStr,
        ingress: 120 + Math.random() * 50,
        egress: 90 + Math.random() * 40
      });
      mockRestart.push({ time: timeStr, value: Math.floor(Math.random() * 2) });
      mockDeploy.push({ time: timeStr, value: 95 + Math.random() * 5 });
    }

    setCpuData(mockCpu);
    setMemData(mockMem);
    setNetData(mockNet);
    setRestartData(mockRestart);
    setDeployHealthData(mockDeploy);
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 15000); // Auto refresh every 15 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Activity className="text-orange-500 animate-pulse" />
            <span>Prometheus Observability Hub</span>
          </h1>
          <p className="text-sm text-brand-textSecondary">
            Monitor real-time scrape configurations, cluster targets, active SRE alerts, and custom PromQL queries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => loadDashboardData(false)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-brand-textPrimary rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Console'}</span>
          </button>
        </div>
      </div>

      {/* Top Banner Status Card */}
      <PrometheusStatusCard status={status} />

      {/* Detailed metrics overview grids */}
      <MetricsOverview status={status} />

      {/* Primary Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CpuTrendChart data={cpuData} loading={loading} />
        <MemoryTrendChart data={memData} loading={loading} />
        <NetworkTrendChart data={netData} loading={loading} />
      </div>

      {/* Secondary SRE Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pod Restart Trends */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft h-[320px] flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Pod Restarts Trend</h3>
            <p className="text-[10px] text-slate-400">Sum of restarted containers across active pods</p>
          </div>
          <div className="flex-1 min-h-0 mt-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={restartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRestart" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                    formatter={(value: any) => [`${Math.floor(Number(value))} restarts`, 'Restarts']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorRestart)" name="Restarts" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Deployment Health */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft h-[320px] flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Deployment Replica Health</h3>
            <p className="text-[10px] text-slate-400">Percentage of desired replicas in ready status</p>
          </div>
          <div className="flex-1 min-h-0 mt-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={deployHealthData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDeploy" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="time" stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '11px' }}
                    formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Replica Health']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorDeploy)" name="Replica Health" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Interactive elements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <QueryConsole />
        </div>
        <div className="lg:col-span-1">
          <AlertsPanel />
        </div>
      </div>
    </div>
  );
}
