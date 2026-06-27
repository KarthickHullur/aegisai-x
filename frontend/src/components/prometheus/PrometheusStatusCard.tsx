import { Activity, AlertTriangle, CheckCircle2, Server, Timer } from 'lucide-react';
import { PrometheusStatus } from '../../services/api';

interface Props {
  status: PrometheusStatus | null;
}

export default function PrometheusStatusCard({ status }: Props) {
  const isConnected = status?.connected || false;
  const version = status?.version || 'v2.x';
  const activeAlerts = status?.activeAlerts || 0;
  const metricsCount = status?.metricsCount || 0;
  const targetsTotal = status?.targetsTotal || 0;
  const targetsHealthy = status?.targetsHealthy || 0;
  const queryLatency = status?.queryLatencyMs || 0;

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-soft hover:shadow-premium transition-all duration-300 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-orange-500/5 to-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700" />
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-4 flex-1">
          <div className={`p-4 rounded-2xl ${
            isConnected ? 'bg-orange-50 text-orange-600' : 'bg-rose-50 text-rose-500'
          } transition-all duration-300`}>
            <Activity size={26} className={isConnected ? 'animate-pulse' : ''} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <h3 className="font-extrabold text-slate-900 text-lg">Prometheus Integration</h3>
              <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                isConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                <span>{isConnected ? 'Connected' : 'Offline'}</span>
              </span>
            </div>
            <p className="text-xs text-brand-textSecondary mt-1 leading-relaxed">
              {isConnected 
                ? `Endpoint active at http://localhost:9090 • Engine version: ${version}` 
                : status?.error || 'Prometheus connection refused. Serving fallback metrics.'
              }
            </p>
          </div>
        </div>

        {isConnected && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:items-center gap-4 flex-shrink-0">
            {/* Scrape Targets */}
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[120px] transition-all hover:bg-slate-50">
              <div className="flex items-center gap-1.5 text-slate-500">
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Targets UP</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {targetsHealthy} <span className="text-xs text-slate-400 font-medium">/ {targetsTotal}</span>
              </div>
            </div>

            {/* Metrics Scraped */}
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[120px] transition-all hover:bg-slate-50">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Server size={13} className="text-brand-primary" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Metrics</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {metricsCount.toLocaleString()}
              </div>
            </div>

            {/* Active Alerts */}
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[120px] transition-all hover:bg-slate-50">
              <div className="flex items-center gap-1.5 text-slate-500">
                <AlertTriangle size={13} className={activeAlerts > 0 ? 'text-amber-500' : 'text-slate-400'} />
                <span className="text-[9px] font-bold uppercase tracking-wider">Active Alerts</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {activeAlerts}
              </div>
            </div>

            {/* Query Latency */}
            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl px-4 py-3 min-w-[120px] transition-all hover:bg-slate-50">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Timer size={13} className="text-indigo-500" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Query Latency</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">
                {queryLatency.toFixed(0)} <span className="text-[10px] text-slate-400 font-medium">ms</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
