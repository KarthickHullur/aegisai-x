import { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { getPrometheusAlerts, PrometheusAlert } from '../../services/api';

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<PrometheusAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPrometheusAlerts();
      if (res.status === 'success' && res.data?.alerts) {
        setAlerts(res.data.alerts);
      } else {
        setAlerts([]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch Prometheus alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-soft flex flex-col justify-between h-[450px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-50">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Active Prometheus Alerts</h3>
          <p className="text-[10px] text-slate-400">Firing alerts dynamically synced every 15s</p>
        </div>
        <button 
          onClick={fetchAlerts}
          disabled={loading}
          className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-500 border border-slate-100 hover:border-slate-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Alert list body */}
      <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-3">
        {loading && alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-2">
            <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
            <span>Syncing active alerts...</span>
          </div>
        ) : null}

        {error && alerts.length === 0 && (
          <div className="flex items-center justify-center h-full text-xs text-rose-500 text-center px-4 font-mono">
            {error}
          </div>
        )}

        {!loading && !error && alerts.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-4 py-8 space-y-2">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500">
              <ShieldCheck size={26} />
            </div>
            <h4 className="font-bold text-slate-800 text-xs mt-2">All Systems Operational</h4>
            <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">
              No firing alerts are currently monitored by the Prometheus scrape configurations.
            </p>
          </div>
        )}

        {alerts.map((alert, idx) => {
          const alertName = alert.labels.alertname || 'Generic Alert';
          const severity = alert.labels.severity || 'high';
          const isCritical = severity.toLowerCase() === 'critical' || severity.toLowerCase() === 'fatal';
          const desc = alert.annotations.description || alert.annotations.summary || 'No description provided';

          return (
            <div 
              key={idx}
              className={`p-4 border rounded-2xl flex gap-3.5 items-start transition-all hover:shadow-soft ${
                isCritical 
                  ? 'bg-rose-50/20 border-rose-100 hover:border-rose-200' 
                  : 'bg-amber-50/20 border-amber-100 hover:border-amber-200'
              }`}
            >
              <div className={`p-2 rounded-xl mt-0.5 ${
                isCritical ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
              }`}>
                <AlertTriangle size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-800 text-xs truncate" title={alertName}>
                    {alertName}
                  </h4>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                    isCritical ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {severity}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                  {desc}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(alert.labels)
                    .filter(([k]) => k !== 'alertname' && k !== 'severity')
                    .map(([k, v]) => (
                      <span key={k} className="text-[8px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                        {k}={v}
                      </span>
                    ))
                  }
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
