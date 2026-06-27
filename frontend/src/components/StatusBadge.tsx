interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const getBadgeStyle = (s: string) => {
    switch (s.toLowerCase()) {
      // Incident Statuses
      case 'investigating':
        return 'bg-brand-warning/10 text-brand-warning border-brand-warning/20';
      case 'open':
        return 'bg-brand-danger/10 text-brand-danger border-brand-danger/20';
      case 'mitigating':
        return 'bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20';
      case 'resolved':
        return 'bg-brand-success/10 text-brand-success border-brand-success/20';
      case 'acknowledged':
        return 'bg-brand-primary/10 text-brand-primary border-brand-primary/20';

      // Agent Statuses
      case 'active':
        return 'bg-brand-success/15 text-brand-success border-brand-success/25 font-bold';
      case 'diagnosing':
        return 'bg-brand-warning/15 text-brand-warning border-brand-warning/25 font-bold';
      case 'idle':
        return 'bg-slate-100 text-brand-textSecondary border-slate-200';
      case 'paused':
        return 'bg-brand-danger/15 text-brand-danger border-brand-danger/25';

      // Generic Statuses
      case 'high':
      case 'critical':
        return 'bg-brand-danger/10 text-brand-danger border-brand-danger/25';
      case 'medium':
      case 'warning':
        return 'bg-brand-warning/10 text-brand-warning border-brand-warning/25';
      case 'low':
      case 'healthy':
        return 'bg-brand-success/10 text-brand-success border-brand-success/25';

      default:
        return 'bg-slate-100 text-brand-textSecondary border-slate-200';
    }
  };

  const getDotStyle = (s: string) => {
    switch (s.toLowerCase()) {
      case 'investigating':
      case 'diagnosing':
      case 'warning':
      case 'medium':
        return 'bg-brand-warning';
      case 'mitigating':
        return 'bg-brand-secondary';
      case 'resolved':
      case 'active':
      case 'healthy':
      case 'low':
        return 'bg-brand-success';
      case 'open':
      case 'paused':
      case 'critical':
      case 'high':
        return 'bg-brand-danger';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border capitalize ${getBadgeStyle(status)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${getDotStyle(status)}`} />
      <span>{status}</span>
    </span>
  );
}
