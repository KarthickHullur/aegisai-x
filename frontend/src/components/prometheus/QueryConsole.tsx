import { useState } from 'react';
import { Play, Terminal, HelpCircle, Loader2 } from 'lucide-react';
import { queryPrometheus } from '../../services/api';

const PRESETS = [
  'rate(container_cpu_usage_seconds_total[5m])',
  'container_memory_usage_bytes',
  'sum(rate(container_network_receive_bytes_total[5m]))',
  'sum(kube_pod_container_status_restarts_total)'
];

export default function QueryConsole() {
  const [query, setQuery] = useState(PRESETS[0]);
  const [loading, setLoading] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunQuery = async (customQuery = query) => {
    if (!customQuery.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setExecutionTime(null);
    setResultCount(null);
    setDegraded(false);
    setWarning(null);

    const start = performance.now();
    try {
      const res = await queryPrometheus(customQuery);
      const end = performance.now();
      
      setExecutionTime(Math.round(end - start));
      setResults(res);
      setDegraded(res.degraded || false);
      setWarning(res.warning || null);

      if (res.status === 'success' && res.data?.result) {
        setResultCount(res.data.result.length);
      } else {
        setResultCount(0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute query');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-premium text-white space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-orange-500 animate-pulse" />
          <h3 className="font-extrabold text-base tracking-tight">PromQL Query Console</h3>
        </div>
        <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-2 py-1 rounded-md">
          v1.0 API Reachable
        </span>
      </div>

      {/* Preset Queries */}
      <div className="space-y-2">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Suggested Queries
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setQuery(preset);
                handleRunQuery(preset);
              }}
              className="text-[10px] font-mono bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600 px-3 py-1.5 rounded-xl transition-all"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="enter PromQL query here..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-orange-500/80 text-orange-200"
          />
        </div>
        <button
          onClick={() => handleRunQuery()}
          disabled={loading}
          className="bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold rounded-2xl px-6 text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} fill="currentColor" />}
          <span>Run Query</span>
        </button>
      </div>

      {/* Warning / Error status */}
      {warning && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl text-[11px] font-medium flex items-center gap-2">
          <HelpCircle size={14} />
          <span>{warning} (Degraded Mode)</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-[11px] font-mono">
          Error: {error}
        </div>
      )}

      {/* Results details strip */}
      {executionTime !== null && (
        <div className="grid grid-cols-3 gap-4 p-3.5 bg-slate-950/60 border border-slate-850 rounded-2xl text-slate-400 text-[10px] uppercase font-bold tracking-wider font-mono">
          <div>
            Execution: <span className="text-orange-400 font-extrabold">{executionTime}ms</span>
          </div>
          <div>
            Count: <span className="text-emerald-400 font-extrabold">{resultCount} results</span>
          </div>
          <div>
            Status: <span className={degraded ? 'text-amber-400' : 'text-emerald-400'}>{degraded ? 'Degraded' : 'Active'}</span>
          </div>
        </div>
      )}

      {/* Output Console */}
      <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 min-h-[180px] max-h-[300px] overflow-y-auto font-mono text-[11px] text-emerald-400">
        {loading && (
          <div className="flex flex-col items-center justify-center h-[140px] text-slate-500 gap-2">
            <Loader2 className="animate-spin text-orange-500" size={24} />
            <span>Querying Prometheus API cluster...</span>
          </div>
        )}

        {!loading && !results && !error && (
          <div className="flex items-center justify-center h-[140px] text-slate-500 text-xs">
            Enter a query and run to view results console.
          </div>
        )}

        {!loading && results && (
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed selection:bg-orange-500/20">
            {JSON.stringify(results, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
