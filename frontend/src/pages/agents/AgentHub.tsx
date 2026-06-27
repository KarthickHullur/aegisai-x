import { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Terminal as ConsoleIcon, 
  Settings2, 
  CheckCircle,
  Sparkles,
  AlertTriangle,
  Brain
} from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { 
  investigateIncident, 
  AIInvestigateResponse, 
  ApiError,
  getDockerStats,
  DockerContainerStats,
  getK8sPods,
  K8sPod
} from '../../services/api';

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'diagnosing' | 'idle' | 'paused';
  description: string;
  health: 'healthy' | 'warning' | 'critical';
  logs: string[];
}

const agentsData: AgentInfo[] = [
  {
    id: 'agent-1',
    name: 'Architect Agent',
    role: 'Blueprint Modeling',
    status: 'idle',
    health: 'healthy',
    description: 'Watches Kubernetes manifests, cloud architectures, and maintains a clean topology catalog.',
    logs: [
      '[18:00:02] [Architect] Initializing core schema scan...',
      '[18:00:04] [Architect] Fetched current AWS resource catalog.',
      '[18:00:06] [Architect] Re-calculated active microservice node mappings.',
      '[18:00:08] [Architect] Graph synchronized: 14,892 nodes verified. Status: Stable.'
    ],
  },
  {
    id: 'agent-2',
    name: 'Incident Investigator Agent',
    role: 'Outage Diagnosis',
    status: 'active',
    health: 'healthy',
    description: 'Diagnoses anomalies, extracts application traces, and recommends mitigations.',
    logs: [
      '[18:14:15] [Investigator] Triggered anomaly profiling for CPU spike.',
      '[18:14:20] [Investigator] Log trace indicates loop thrashing in `/bin/auth-worker`.',
      '[18:14:32] [Investigator] Initiated replica pool expansion on K8s cluster.',
      '[18:14:45] [Investigator] Mitigation verified. Processing root cause analysis summary...'
    ],
  },
  {
    id: 'agent-3',
    name: 'Security Agent',
    role: 'Threat Detection',
    status: 'active',
    health: 'healthy',
    description: 'Scans for IAM leak risk, outdated TLS/SSL configs, open ports, and package CVEs.',
    logs: [
      '[17:55:00] [Security] Running TLS expiration verification on 12 namespaces...',
      '[17:55:12] [Security] Found certificate expiring in 15 days on namespace: `ingress-production`.',
      '[18:05:00] [Security] Periodic IAM access credential scan started.',
      '[18:05:22] [Security] All keys audited. Revoked deprecated policy token successfully.'
    ],
  },
  {
    id: 'agent-4',
    name: 'Reliability Agent',
    role: 'Self-Healing Engine',
    status: 'active',
    health: 'healthy',
    description: 'Executes automated recovery operations, restarts nodes, and scales storage disks.',
    logs: [
      '[18:10:00] [Reliability] Database write queue monitored. Latency spike: 240ms.',
      '[18:10:12] [Reliability] Scaling replica set counts from 2 to 4.',
      '[18:11:30] [Reliability] Sync complete. Replica instances connected.',
      '[18:12:00] [Reliability] DB latency stabilized to 12ms. Alert closed.'
    ],
  },
  {
    id: 'agent-5',
    name: 'Performance Agent',
    role: 'Payload Profiler',
    status: 'idle',
    health: 'warning',
    description: 'Tracks network performance, queue delays, API latencies, and payload sizes.',
    logs: [
      '[16:30:00] [Performance] Tracking API payload sizes on gateway controller...',
      '[16:30:15] [Performance] Warning: spike detected in response size for `/api/v1/metrics`.',
      '[16:35:00] [Performance] Warning cleared. Cache rules loaded.'
    ],
  },
  {
    id: 'agent-6',
    name: 'Cost Agent',
    role: 'FinOps Optimization',
    status: 'idle',
    health: 'healthy',
    description: 'Audits resource allocations, recommends instance downsizings, and monitors wastage.',
    logs: [
      '[15:00:00] [Cost] Analyzing EC2/RDS utilization logs for target week.',
      '[15:00:15] [Cost] Found 3 underutilized databases in Staging cluster.',
      '[15:00:20] [Cost] Projected savings for scaling: $320/month.'
    ],
  },
  {
    id: 'agent-7',
    name: 'Memory Agent',
    role: 'Knowledge Indexer',
    status: 'active',
    health: 'healthy',
    description: 'Indexes infrastructure logs, deployments, and creates vectorized runbooks.',
    logs: [
      '[18:12:00] [Memory] Vectorizing outage report: RDS DB Latency Spike.',
      '[18:12:15] [Memory] Running semantic indexing on runbook reference library...',
      '[18:13:00] [Memory] Database incident schema stored in context node #412.'
    ],
  }
];

export default function AgentHub() {
  const [agents, setAgents] = useState<AgentInfo[]>(agentsData);
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo>(agentsData[1]);
  const [terminalLogs, setTerminalLogs] = useState<string[]>(agentsData[1].logs);
  const [containerStats, setContainerStats] = useState<DockerContainerStats[]>([]);

  const [k8sPods, setK8sPods] = useState<K8sPod[]>([]);

  useEffect(() => {
    const fetchSreData = async () => {
      try {
        const stats = await getDockerStats();
        setContainerStats(stats);
      } catch (err) {
        console.error('Failed to fetch container stats:', err);
      }

      try {
        const pods = await getK8sPods();
        setK8sPods(pods);
      } catch (err) {
        console.error('Failed to fetch K8s pods:', err);
      }
    };

    fetchSreData();
    const interval = setInterval(fetchSreData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Load persisted logs on mount
  useEffect(() => {
    const persisted = localStorage.getItem('investigator_logs');
    if (persisted) {
      try {
        const parsed = JSON.parse(persisted);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAgents(prev => {
            const next = prev.map(agent => {
              if (agent.id === 'agent-2' || agent.name.includes('Investigator')) {
                return {
                  ...agent,
                  logs: [...agentsData[1].logs, ...parsed]
                };
              }
              return agent;
            });

            // Sync console if Investigator is the selected agent
            const updatedInvestigator = next.find(a => a.id === 'agent-2' || a.name.includes('Investigator'));
            if (updatedInvestigator && selectedAgent.id === updatedInvestigator.id) {
              setSelectedAgent(updatedInvestigator);
              setTerminalLogs(updatedInvestigator.logs);
            }

            return next;
          });
        }
      } catch (e) {
        console.error('Failed to parse persisted investigator logs:', e);
      }
    }
  }, [selectedAgent.id]);

  // Sync log viewer when selected agent changes
  useEffect(() => {
    setTerminalLogs(selectedAgent.logs);
  }, [selectedAgent]);

  const toggleAgent = (id: string) => {
    setAgents(prev => prev.map(agent => {
      if (agent.id === id) {
        const nextStatus: AgentInfo['status'] = agent.status === 'paused' ? 'active' : 'paused';
        const updated: AgentInfo = { ...agent, status: nextStatus };
        if (selectedAgent.id === id) {
          setSelectedAgent(updated);
        }
        return updated;
      }
      return agent;
    }));
  };

  const runDiagnostic = (_agentId: string) => {
    setTerminalLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [Command] Initiating manual diagnostic run...`,
      `[${new Date().toLocaleTimeString()}] [Diagnostic] Scanning resource blocks for dependencies...`,
      `[${new Date().toLocaleTimeString()}] [Diagnostic] Diagnostics success. No anomalies detected.`
    ]);
  };

  // AI Incident Investigator States
  const [aiIncident, setAiIncident] = useState<string>('');
  const [aiSeverity, setAiSeverity] = useState<string>('High');
  const [aiLogs, setAiLogs] = useState<string>('');
  const [aiResult, setAiResult] = useState<AIInvestigateResponse | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAIInvestigate = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!aiIncident.trim()) return;

    try {
      setAiLoading(true);
      setAiError(null);
      setAiResult(null);

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

      setTerminalLogs(prev => [...prev, ...newLogs]);

      setAgents(prev => prev.map(agent => {
        if (agent.id === 'agent-2' || agent.name.includes('Investigator')) {
          return {
            ...agent,
            logs: [...agent.logs, ...newLogs]
          };
        }
        return agent;
      }));

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Agent Control Hub</h1>
          <p className="text-sm text-brand-textSecondary">Manage and coordinate autonomous site reliability intelligence agents.</p>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-brand-textPrimary rounded-xl text-xs font-bold transition-all">
            <Settings2 size={14} />
            <span>Coordination Settings</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Side: Agent List Grid */}
        <div className="xl:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => {
              const isSelected = selectedAgent.id === agent.id;
              return (
                <div 
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`cursor-pointer bg-white border rounded-2xl p-5 shadow-soft hover:shadow-premium transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-[210px] ${
                    isSelected ? 'ring-2 ring-brand-primary border-transparent' : 'border-slate-100'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-brand-textPrimary text-sm">{agent.name}</h3>
                        <span className="text-[10px] text-brand-textSecondary uppercase font-bold tracking-wider">{agent.role}</span>
                      </div>
                      
                      {/* Health indicator */}
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${
                        agent.health === 'healthy' ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-warning/10 text-brand-warning'
                      }`}>
                        <CheckCircle size={10} />
                        <span>{agent.health}</span>
                      </span>
                    </div>

                    <p className="text-xs text-brand-textSecondary mt-2 line-clamp-2 leading-relaxed">
                      {agent.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        agent.status === 'active' ? 'bg-brand-success animate-pulse' :
                        agent.status === 'diagnosing' ? 'bg-brand-warning' : 'bg-slate-400'
                      }`} />
                      <StatusBadge status={agent.status} />
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAgent(agent.id);
                      }}
                      className={`p-1.5 rounded-lg border transition-all ${
                        agent.status === 'paused' 
                          ? 'bg-brand-success/10 text-brand-success border-brand-success/20 hover:bg-brand-success/20'
                          : 'bg-slate-50 text-slate-600 hover:text-brand-danger hover:bg-brand-danger/5 border-slate-200'
                      }`}
                    >
                      {agent.status === 'paused' ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Log Console / Interactive Terminal */}
        <div className="xl:col-span-1 space-y-6">
          <div className="border border-slate-900 bg-slate-950 rounded-2xl shadow-premium overflow-hidden h-[436px] flex flex-col justify-between">
            
            {/* Console Header */}
            <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <ConsoleIcon size={14} className="text-brand-success" />
                <span className="text-xs font-mono font-semibold">{selectedAgent.name} Console</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500">x</span>
              </div>
            </div>

            {/* Terminal Body */}
            {/* Terminal Body, Performance Monitor, or Reliability Recommendations */}
            {selectedAgent.id === 'agent-5' || selectedAgent.name.includes('Performance') ? (
              <div className="flex-1 p-4 overflow-y-auto space-y-4 font-sans select-none text-slate-350">
                {/* Top CPU Consumers */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider block border-b border-slate-800 pb-1">Top CPU Consumers</span>
                  {containerStats.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-1">No CPU telemetry scraped.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {[...containerStats].sort((a, b) => b.cpuPercent - a.cpuPercent).slice(0, 3).map((stat) => (
                        <div key={stat.containerId} className="flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-200">{stat.name}</span>
                          <span className="font-mono text-orange-400 font-bold">{stat.cpuPercent.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top Memory Consumers */}
                <div className="space-y-2 pt-1">
                  <span className="text-[9px] font-bold text-purple-400 uppercase tracking-wider block border-b border-slate-800 pb-1">Top Memory Consumers</span>
                  {containerStats.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-1">No memory telemetry scraped.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {[...containerStats].sort((a, b) => b.memoryPercent - a.memoryPercent).slice(0, 3).map((stat) => (
                        <div key={stat.containerId} className="flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-200">{stat.name}</span>
                          <span className="font-mono text-purple-400 font-bold">{stat.memoryPercent.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hotspots */}
                <div className="space-y-2 pt-1">
                  <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider block border-b border-slate-800 pb-1">Resource Hotspots</span>
                  {containerStats.filter(c => c.cpuPercent > 80 || c.memoryPercent > 80).length === 0 ? (
                    <p className="text-[10px] text-emerald-400 font-mono py-1">✓ No active SRE resource hotspots detected</p>
                  ) : (
                    <div className="space-y-1">
                      {containerStats.filter(c => c.cpuPercent > 80 || c.memoryPercent > 80).map((stat) => (
                        <div key={stat.containerId} className="text-[11px] bg-rose-950/20 border border-rose-900/30 rounded-lg p-2 text-rose-300">
                          Container <span className="font-bold text-white">{stat.name}</span> is thrashing (CPU: {stat.cpuPercent.toFixed(0)}%, Mem: {stat.memoryPercent.toFixed(0)}%)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : selectedAgent.id === 'agent-4' || selectedAgent.name.includes('Reliability') ? (
              <div className="flex-1 p-4 overflow-y-auto space-y-4 font-sans text-slate-350">
                {/* CrashLoops */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider block border-b border-slate-800 pb-1">CrashLoopBackOff Pods</span>
                  {k8sPods.filter(p => p.status.toLowerCase().includes('crash') || p.status.toLowerCase().includes('fail')).length === 0 ? (
                    <p className="text-[10px] text-emerald-400 font-mono py-1">✓ 0 pods in CrashLoopBackOff state</p>
                  ) : (
                    <div className="space-y-1.5">
                      {k8sPods.filter(p => p.status.toLowerCase().includes('crash') || p.status.toLowerCase().includes('fail')).map((pod) => (
                        <div key={pod.name} className="flex justify-between items-center text-xs text-rose-300">
                          <span className="font-medium truncate pr-2">{pod.name}</span>
                          <span className="font-bold font-mono px-2 py-0.5 bg-rose-900/30 rounded">{pod.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Restarting Containers */}
                <div className="space-y-2 pt-1">
                  <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block border-b border-slate-800 pb-1">Restarting Containers</span>
                  {k8sPods.filter(p => p.restartCount > 0).length === 0 ? (
                    <p className="text-[10px] text-emerald-400 font-mono py-1">✓ 0 restarted pods in cluster</p>
                  ) : (
                    <div className="space-y-1.5">
                      {k8sPods.filter(p => p.restartCount > 0).map((pod) => (
                        <div key={pod.name} className="flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-200 truncate pr-2">{pod.name}</span>
                          <span className="font-mono text-amber-400 font-bold">{pod.restartCount} restarts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pressure Events */}
                <div className="space-y-2 pt-1">
                  <span className="text-[9px] font-bold text-sky-400 uppercase tracking-wider block border-b border-slate-800 pb-1">Node Pressure Events</span>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between items-center text-slate-350">
                      <span>Memory Pressure</span>
                      <span className="text-emerald-400 font-mono font-bold">None</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-350">
                      <span>Disk Pressure</span>
                      <span className="text-emerald-400 font-mono font-bold">None</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedAgent.id === 'agent-3' || selectedAgent.name.includes('Security') ? (
              <div className="flex-1 p-4 overflow-y-auto space-y-4 font-sans text-slate-350">
                {/* Unhealthy Targets */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider block border-b border-slate-800 pb-1">Unhealthy Scrape Targets</span>
                  <p className="text-[10px] text-emerald-400 font-mono py-1">✓ All Prometheus targets healthy (health = UP)</p>
                </div>

                {/* Missing Scrape Configs */}
                <div className="space-y-2 pt-1">
                  <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider block border-b border-slate-800 pb-1">Missing Scrape Configurations</span>
                  <div className="space-y-1 text-[11px] text-slate-400">
                    <p className="font-mono text-slate-500">Scanning prometheus.yml...</p>
                    <p className="font-mono text-emerald-400">✓ cAdvisor scrape configuration verified</p>
                    <p className="font-mono text-emerald-400">✓ kube-state-metrics scraper verified</p>
                  </div>
                </div>

                {/* Exposed Endpoints */}
                <div className="space-y-2 pt-1">
                  <span className="text-[9px] font-bold text-sky-400 uppercase tracking-wider block border-b border-slate-800 pb-1">Exposed Metrics Endpoints</span>
                  <div className="space-y-1 text-xs">
                    <div className="text-[11px] bg-slate-900 border border-slate-850 rounded-lg p-2 font-mono text-slate-300">
                      <span className="text-amber-400">Warning:</span> Port 9090 (Prometheus GUI) exposed to 0.0.0.0. Recommend binding to localhost only.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 p-4 font-mono text-xs text-slate-300 overflow-y-auto space-y-2 select-text selection:bg-brand-primary/30 selection:text-white">
                {terminalLogs.map((log, index) => (
                  <div key={index} className="leading-relaxed">
                    <span className="text-slate-500 font-medium">{log.substring(0, 10)}</span>
                    <span className="text-brand-success">{log.substring(10, 20)}</span>
                    <span className="text-slate-100">{log.substring(20)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Console Action Strip */}
            <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex gap-2">
              <button 
                onClick={() => runDiagnostic(selectedAgent.id)}
                className="flex-1 text-center py-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl text-xs transition-colors shadow-soft"
              >
                Trigger Scan
              </button>
              <button 
                onClick={() => setTerminalLogs(selectedAgent.logs)}
                className="px-3 py-2 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white font-bold rounded-xl text-xs transition-colors"
              >
                Clear Console
              </button>
            </div>

          </div>

          {/* AI Incident Investigator Section */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft space-y-4 animate-fade-in">
            <div>
              <h3 className="font-bold text-brand-textPrimary text-base flex items-center gap-2">
                <Sparkles size={18} className="text-brand-primary animate-pulse" />
                <span>AI Incident Investigator</span>
              </h3>
              <p className="text-xs text-brand-textSecondary">
                Run automated, agent-driven root-cause analysis, system impact audits, and remediation steps.
              </p>
            </div>

            <form onSubmit={handleAIInvestigate} className="space-y-4">
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

            {/* Results/State Container */}
            <div className="flex flex-col justify-center min-h-[120px] pt-4 border-t border-slate-100">
              {aiLoading && (
                <div className="flex flex-col items-center justify-center py-4 space-y-3">
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
                <div className="flex flex-col items-center justify-center py-4 text-center border-2 border-dashed border-slate-100 rounded-2xl p-4">
                  <Brain size={32} className="text-slate-200 mb-2 stroke-[1.5]" />
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

                  {/* Root Cause & Impact */}
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1">
                      <h5 className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider">Root Cause</h5>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <p className="text-xs text-brand-textPrimary leading-relaxed font-medium">
                          {aiResult.rootCause}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h5 className="text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider">Impact</h5>
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
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
        </div>
      </div>
    </div>
  );
}
