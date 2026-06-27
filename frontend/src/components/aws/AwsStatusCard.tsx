import { AwsStatus } from '../../services/api';
import { ShieldCheck, ShieldAlert, Key, Cloud } from 'lucide-react';

interface AwsStatusCardProps {
  status: AwsStatus | null;
  loading: boolean;
  onSync: () => void;
}

export default function AwsStatusCard({ status, loading, onSync }: AwsStatusCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm animate-pulse">
        <div className="h-6 w-40 bg-slate-100 rounded-lg mb-4" />
        <div className="h-4 w-64 bg-slate-50 rounded-lg" />
      </div>
    );
  }

  const isConnected = status?.connected || false;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-2xl ${
            isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}>
            {isConnected ? <ShieldCheck size={28} /> : <ShieldAlert size={28} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-lg">Amazon Web Services</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                isConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {isConnected ? 'Connected' : 'Degraded Mode'}
              </span>
            </div>
            
            {isConnected ? (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-slate-600 font-medium">
                  Account ID: <span className="font-mono text-slate-800 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">{status?.accountId || '123456789012'}</span>
                </p>
                <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                  <Key size={12} /> Authenticated via: <span className="text-slate-500 font-semibold">{status?.authSource}</span>
                </p>
              </div>
            ) : (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-rose-600 font-medium">
                  Reason: Authentication credentials unavailable.
                </p>
                <p className="text-xs text-slate-400 font-medium italic">
                  Using cached PostgreSQL snapshot data.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onSync}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold bg-brand-primary hover:bg-brand-primaryHover text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50"
          >
            <Cloud size={16} />
            Sync Now
          </button>
        </div>
      </div>
    </div>
  );
}
