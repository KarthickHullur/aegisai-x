import { useState, useEffect } from 'react';
import { CheckCircle, PlayCircle, MoreHorizontal } from 'lucide-react';
import StatusBadge from './StatusBadge';

export interface Incident {
  id: string;
  incident_code?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  name: string;
  source: string;
  status: 'investigating' | 'mitigating' | 'resolved' | 'acknowledged' | 'open';
  time: string;
  occurrence_count?: number;
  last_seen?: string;
}

interface IncidentTableProps {
  incidents: Incident[];
  onInvestigate?: (incidentId: string) => void;
  onResolve?: (incidentId: string) => void;
}

export default function IncidentTable({
  incidents: initialIncidents,
  onInvestigate,
  onResolve,
}: IncidentTableProps) {
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);

  useEffect(() => {
    setIncidents(initialIncidents);
  }, [initialIncidents]);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredIncidents = incidents.filter((incident) => {
    const matchesSeverity = severityFilter === 'all' || incident.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
    return matchesSeverity && matchesStatus;
  });

  const handleResolveLocal = (id: string) => {
    setIncidents(prev =>
      prev.map(inc => inc.id === id ? { ...inc, status: 'resolved' } : inc)
    );
    if (onResolve) onResolve(id);
  };

  const getSeverityStyle = (sev: Incident['severity']) => {
    switch (sev) {
      case 'critical': return 'bg-brand-danger/10 text-brand-danger border-brand-danger/20';
      case 'high': return 'bg-brand-warning/10 text-brand-warning border-brand-warning/20';
      case 'medium': return 'bg-brand-primary/10 text-brand-primary border-brand-primary/20';
      case 'low': return 'bg-slate-100 text-brand-textSecondary border-slate-200';
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-soft overflow-hidden">
      {/* Table Filter Panel */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-bold text-brand-textPrimary text-sm">System Outages & Incidents</h3>
          <p className="text-xs text-brand-textSecondary">Real-time alerts and mitigation logs</p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-3">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 outline-none hover:border-brand-primary transition-colors cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 outline-none hover:border-brand-primary transition-colors cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="investigating">Investigating</option>
            <option value="mitigating">Mitigating</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-brand-textSecondary tracking-wider uppercase">
              <th className="py-3.5 px-6">Severity</th>
              <th className="py-3.5 px-4">Incident Name</th>
              <th className="py-3.5 px-4 hidden md:table-cell">Source</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 hidden lg:table-cell">Time</th>
              <th className="py-3.5 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-brand-textSecondary">
                  No incidents matched your criteria. Everything looks stable!
                </td>
              </tr>
            ) : (
              filteredIncidents.map((incident) => (
                <tr key={incident.id} className="hover:bg-slate-50/50 transition-colors group">
                  {/* Severity */}
                  <td className="py-4 px-6">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border capitalize ${getSeverityStyle(incident.severity)}`}>
                      {incident.severity}
                    </span>
                  </td>

                  {/* Incident Name */}
                  <td className="py-4 px-4 font-semibold text-brand-textPrimary">
                    <div className="flex flex-wrap items-center gap-2">
                      {incident.incident_code && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-md font-mono border border-slate-200">
                          {incident.incident_code}
                        </span>
                      )}
                      <span>{incident.name}</span>
                      {incident.occurrence_count && incident.occurrence_count > 1 && (
                        <span className="text-[9px] bg-brand-danger/10 text-brand-danger font-extrabold px-1.5 py-0.5 rounded-full border border-brand-danger/20 animate-pulse">
                          {incident.occurrence_count} occurrences
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Source */}
                  <td className="py-4 px-4 text-brand-textSecondary hidden md:table-cell font-medium">
                    {incident.source}
                  </td>

                  {/* Status */}
                  <td className="py-4 px-4">
                    <StatusBadge status={incident.status} />
                  </td>

                  {/* Time */}
                  <td className="py-4 px-4 text-brand-textSecondary hidden lg:table-cell">
                    {incident.time}
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      {incident.status !== 'resolved' && (
                        <button
                          onClick={() => handleResolveLocal(incident.id)}
                          title="Mark Resolved"
                          className="p-1.5 text-brand-success hover:bg-brand-success/5 rounded-lg border border-transparent hover:border-brand-success/20 transition-all duration-200"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => onInvestigate && onInvestigate(incident.id)}
                        title="Investigate Incident"
                        className="p-1.5 text-brand-primary hover:bg-brand-primary/5 rounded-lg border border-transparent hover:border-brand-primary/20 transition-all duration-200"
                      >
                        <PlayCircle size={14} />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
