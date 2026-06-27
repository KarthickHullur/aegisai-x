import { 
  Activity, 
  CheckCircle2, 
  Server, 
  AlertTriangle, 
  Timer
} from 'lucide-react';
import { PrometheusStatus } from '../../services/api';

interface Props {
  status: PrometheusStatus | null;
}

export default function MetricsOverview({ status }: Props) {
  const isConnected = status?.connected || false;
  const activeAlerts = status?.activeAlerts || 0;
  const metricsCount = status?.metricsCount || 0;
  const targetsTotal = status?.targetsTotal || 0;
  const targetsHealthy = status?.targetsHealthy || 0;
  const queryLatency = status?.queryLatencyMs || 0;

  const targetPercentage = targetsTotal > 0 ? Math.round((targetsHealthy / targetsTotal) * 100) : 0;

  const cards = [
    {
      title: 'Prometheus Connected',
      value: isConnected ? 'Active' : 'Offline',
      desc: isConnected ? `Version: ${status?.version || 'v2.x'}` : 'Connection refused',
      status: isConnected ? 'positive' : 'negative',
      icon: <Activity size={18} />,
      color: 'from-orange-500 to-amber-500',
      bg: 'bg-orange-50/50'
    },
    {
      title: 'Targets Healthy',
      value: `${targetsHealthy} / ${targetsTotal}`,
      desc: `${targetPercentage}% scrape endpoints UP`,
      status: targetPercentage === 100 ? 'positive' : targetPercentage > 50 ? 'neutral' : 'negative',
      icon: <CheckCircle2 size={18} />,
      color: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50/50'
    },
    {
      title: 'Metrics Collected',
      value: metricsCount.toLocaleString(),
      desc: 'Active scraped metrics names',
      status: isConnected ? 'positive' : 'neutral',
      icon: <Server size={18} />,
      color: 'from-blue-500 to-indigo-500',
      bg: 'bg-blue-50/50'
    },
    {
      title: 'Alerts Active',
      value: String(activeAlerts),
      desc: activeAlerts > 0 ? `${activeAlerts} firing alerts` : '0 issues firing',
      status: activeAlerts > 0 ? 'negative' : 'positive',
      icon: <AlertTriangle size={18} />,
      color: 'from-rose-500 to-red-500',
      bg: 'bg-rose-50/50'
    },
    {
      title: 'Query Latency',
      value: `${queryLatency.toFixed(0)} ms`,
      desc: isConnected ? 'API query response time' : 'Connection timeout',
      status: isConnected ? (queryLatency < 100 ? 'positive' : queryLatency < 300 ? 'neutral' : 'negative') : 'neutral',
      icon: <Timer size={18} />,
      color: 'from-purple-500 to-pink-500',
      bg: 'bg-purple-50/50'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
      {cards.map((card, idx) => {
        const isPos = card.status === 'positive';
        const isNeg = card.status === 'negative';

        return (
          <div 
            key={idx}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-soft hover:shadow-premium transition-all duration-300 flex flex-col justify-between h-[145px] group relative overflow-hidden"
          >
            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-brand-textSecondary tracking-wider uppercase">
                  {card.title}
                </span>
                <div className="text-2xl font-black text-slate-800 tracking-tight mt-0.5">
                  {card.value}
                </div>
              </div>

              <div className={`p-2.5 rounded-xl ${card.bg} text-slate-600 group-hover:bg-gradient-to-br ${card.color} group-hover:text-white transition-all duration-300`}>
                {card.icon}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 relative z-10">
              <span className="text-[11px] font-semibold text-slate-400">
                {card.desc}
              </span>
              <span className={`w-2 h-2 rounded-full ${
                isPos ? 'bg-emerald-500' : isNeg ? 'bg-rose-500' : 'bg-amber-500'
              } animate-pulse`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
