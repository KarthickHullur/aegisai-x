import { useState } from 'react';
import { Play, Pause, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import StatusBadge from './StatusBadge';

interface AgentCardProps {
  name: string;
  role: string;
  status: 'idle' | 'active' | 'diagnosing' | 'paused';
  health: 'healthy' | 'warning' | 'critical';
  lastActivity: string;
  progress: number;
}

export default function AgentCard({
  name,
  role,
  status: initialStatus,
  health,
  lastActivity,
  progress,
}: AgentCardProps) {
  const [status, setStatus] = useState(initialStatus);

  const getStatusColor = (s: typeof status) => {
    switch (s) {
      case 'active': return 'bg-brand-success text-brand-success';
      case 'diagnosing': return 'bg-brand-warning text-brand-warning';
      case 'idle': return 'bg-slate-400 text-slate-400';
      case 'paused': return 'bg-brand-danger text-brand-danger';
    }
  };

  const getHealthIcon = (h: typeof health) => {
    switch (h) {
      case 'healthy':
        return <CheckCircle2 size={16} className="text-brand-success" />;
      case 'warning':
        return <AlertCircle size={16} className="text-brand-warning" />;
      case 'critical':
        return <AlertCircle size={16} className="text-brand-danger" />;
    }
  };

  const toggleStatus = () => {
    if (status === 'paused') {
      setStatus('active');
    } else {
      setStatus('paused');
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft hover:shadow-premium transition-all duration-300 flex flex-col justify-between h-[230px] relative overflow-hidden group">
      {/* Background visual pulsing when active */}
      {status === 'active' && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-2xl -mr-10 -mt-10" />
      )}

      {/* Card Header */}
      <div>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-slate-900 group-hover:text-brand-primary transition-colors duration-200">
              {name}
            </h3>
            <span className="text-[10px] font-semibold text-brand-textSecondary uppercase tracking-wider">
              {role}
            </span>
          </div>

          {/* Health indicator */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg">
            {getHealthIcon(health)}
            <span className="text-[10px] font-bold text-brand-textPrimary capitalize">
              {health}
            </span>
          </div>
        </div>

        {/* Status indicator line */}
        <div className="flex items-center gap-2 mt-4">
          <span className="relative flex h-2 w-2">
            {status === 'active' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-success opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${getStatusColor(status).split(' ')[0]}`} />
          </span>
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Progress & Activities */}
      <div className="space-y-3 mt-4">
        {/* Progress horizontal bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-brand-textSecondary">
            <span>Workload Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 bg-main-gradient`} 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Activity feed snippet */}
        <div className="flex items-center gap-1.5 text-xs text-brand-textSecondary">
          <Activity size={12} className="text-slate-400 flex-shrink-0" />
          <span className="truncate">{lastActivity}</span>
        </div>
      </div>

      {/* Bottom control strip */}
      <div className="border-t border-slate-50 pt-3 mt-4 flex items-center justify-between">
        <span className="text-[10px] text-brand-textSecondary font-semibold">
          AI Auto-Healing Allowed
        </span>
        <button
          onClick={toggleStatus}
          className={`p-1.5 rounded-lg border transition-all duration-200 ${
            status === 'paused'
              ? 'border-brand-success/30 bg-brand-success/5 text-brand-success hover:bg-brand-success/10'
              : 'border-slate-200 bg-white text-slate-500 hover:text-brand-primary hover:border-brand-primary'
          }`}
        >
          {status === 'paused' ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
        </button>
      </div>
    </div>
  );
}
