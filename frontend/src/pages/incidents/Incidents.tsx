import { useState, useEffect } from 'react';
import { 
  AlertOctagon, 
  CheckCircle2, 
  Clock, 
  Search, 
  Terminal,
  TrendingDown
} from 'lucide-react';
import IncidentTable, { Incident } from '../../components/IncidentTable';
import { getIncidents } from '../../services/api';
import { formatFriendlyTimestamp } from '../../utils/dateFormatter';

const incidentDetailsLookup: Record<string, { source: string }> = {
  'CPU Spike': { source: 'kube-us-east-cluster' },
  'Memory Exhaustion': { source: 'rds-aurora-postgres' },
  'TLS Certificate Expiring': { source: 'cert-manager-production' },
  'K8s Cluster node memory exhaustion': { source: 'kube-us-east-cluster' },
  'DB Write Latency anomaly spike': { source: 'rds-aurora-postgres' },
  'API response code 502 Bad Gateway': { source: 'ingress-nginx-controller' },
  'SSL/TLS Certificate expiring in 15 days': { source: 'cert-manager-production' }
};

export default function Incidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      setError(null);
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
      if (mappedIncidents.length > 0) {
        setSelectedIncident(mappedIncidents[0]);
      }
    } catch (err: any) {
      console.error('Failed to fetch incidents:', err);
      setError('Unable to load incidents from AegisAI-X backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const activeCount = incidents.filter(i => i.status !== 'resolved').length;
  const criticalCount = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;
  const mitigatedCount = incidents.filter(i => i.status === 'resolved').length;

  const filteredIncidents = incidents.filter(inc => 
    inc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inc.source.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Incident Command Center</h1>
          <p className="text-sm text-brand-textSecondary">Investigate system failures and review agent-driven resolutions.</p>
        </div>
        <button 
          onClick={fetchIncidents}
          className="px-4 py-2 text-xs font-bold text-white bg-brand-primary hover:bg-brand-primary/95 rounded-xl shadow-soft transition-all active:scale-95"
        >
          Refresh Incidents
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
          <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-brand-textSecondary animate-pulse">Loading incidents...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-6 bg-red-50/50 border border-brand-danger/20 rounded-3xl space-y-4">
          <AlertOctagon className="w-10 h-10 text-brand-danger animate-bounce" />
          <h3 className="text-sm font-bold text-slate-900">{error}</h3>
          <button 
            onClick={fetchIncidents}
            className="px-4 py-2 text-xs font-bold text-white bg-brand-primary rounded-xl"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Overview stats */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex items-center gap-4">
              <div className="p-3 bg-brand-danger/10 text-brand-danger rounded-xl">
                <AlertOctagon size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-brand-textPrimary">{criticalCount}</div>
                <div className="text-xs font-semibold text-brand-textSecondary uppercase">Active Critical Outages</div>
              </div>
            </div>

            <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex items-center gap-4">
              <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
                <Clock size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-brand-textPrimary">{activeCount}</div>
                <div className="text-xs font-semibold text-brand-textSecondary uppercase">Total Open Alerts</div>
              </div>
            </div>

            <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex items-center gap-4">
              <div className="p-3 bg-brand-success/10 text-brand-success rounded-xl">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-brand-textPrimary">{mitigatedCount}</div>
                <div className="text-xs font-semibold text-brand-textSecondary uppercase">Resolved Incidents</div>
              </div>
            </div>
          </section>

          {/* Main split display */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: List table */}
            <div className="lg:col-span-2 space-y-4">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3 text-brand-textSecondary" size={16} />
                <input
                  type="text"
                  placeholder="Search by incident name, cluster, or system source..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:border-brand-primary text-sm shadow-soft transition-colors"
                />
              </div>

              <IncidentTable 
                incidents={filteredIncidents} 
                onInvestigate={(id) => {
                  const matched = incidents.find(i => i.id === id);
                  if (matched) setSelectedIncident(matched);
                }}
              />
            </div>

            {/* Right column: Diagnostic / Root Cause Details */}
            <div className="lg:col-span-1">
              {selectedIncident ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft space-y-5 sticky top-24">
                  <div className="pb-3 border-b border-slate-50 flex justify-between items-start">
                    <div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border capitalize ${
                        selectedIncident.severity === 'critical' ? 'bg-brand-danger/10 text-brand-danger border-brand-danger/20' : 
                        selectedIncident.severity === 'high' ? 'bg-brand-warning/10 text-brand-warning border-brand-warning/20' : 
                        'bg-brand-primary/10 text-brand-primary border-brand-primary/20'
                      }`}>
                        {selectedIncident.severity}
                      </span>
                      <h3 className="font-bold text-brand-textPrimary mt-1.5">{selectedIncident.name}</h3>
                    </div>
                  </div>

                  {/* Summary metadata */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="block text-[10px] text-brand-textSecondary uppercase font-bold">Source Element</span>
                      <span className="font-semibold text-brand-textPrimary truncate block">{selectedIncident.source}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="block text-[10px] text-brand-textSecondary uppercase font-bold">Last Seen</span>
                      <span className="font-semibold text-brand-textPrimary block">{selectedIncident.time}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="block text-[10px] text-brand-textSecondary uppercase font-bold">Incident Code</span>
                      <span className="font-semibold text-brand-textPrimary block font-mono">
                        {selectedIncident.incident_code || `INC-${selectedIncident.id.padStart(4, '0')}`}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="block text-[10px] text-brand-textSecondary uppercase font-bold">Occurrences</span>
                      <span className="font-semibold text-brand-textPrimary block">
                        {selectedIncident.occurrence_count || 1}
                      </span>
                    </div>
                  </div>

                  {/* Investigator details */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-brand-textPrimary uppercase tracking-wider flex items-center gap-1.5">
                      <Terminal size={14} className="text-brand-primary" />
                      <span>Agent Mitigation Logs</span>
                    </h4>

                    <div className="border-l-2 border-brand-primary pl-4 ml-2 space-y-4 py-1 text-xs">
                      <div>
                        <div className="font-semibold text-slate-800">1. Node Profiling</div>
                        <p className="text-brand-textSecondary mt-0.5">
                          Incident Investigator Agent analyzed thread heaps. Heavy load detected in sub-process `/bin/auth-worker` (PID: 3410).
                        </p>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">2. Outage Correlation</div>
                        <p className="text-brand-textSecondary mt-0.5">
                          Correlated memory exhaustion with a dependency release triggered on microservice `auth-service:v2.1.2` (14:15 UTC).
                        </p>
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800 flex items-center gap-1">
                          <span>3. Mitigation recommendation</span>
                          <span className="text-[10px] font-bold text-brand-success bg-brand-success/15 px-1.5 py-0.2 rounded-md">Executed</span>
                        </div>
                        <p className="text-brand-textSecondary mt-0.5">
                          Restarted node pools and initiated automated traffic shedding (20% reduction) to prevent cascade failures.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Diagnostics Actions */}
                  <div className="pt-3 border-t border-slate-50 flex gap-2">
                    <button className="flex-1 text-center py-2 rounded-xl bg-brand-primary hover:bg-brand-primary/95 text-white text-xs font-bold shadow-soft transition-colors">
                      Open Anomaly Trace
                    </button>
                    <button className="px-3 py-2 border border-slate-200 hover:border-brand-primary text-slate-700 hover:text-brand-primary rounded-xl text-xs font-bold transition-colors">
                      Export Log
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-2xl p-8 shadow-soft text-center text-brand-textSecondary">
                  <TrendingDown className="mx-auto text-slate-300 mb-3" size={32} />
                  <p className="text-xs font-semibold">Select an incident to view diagnostics detail</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
