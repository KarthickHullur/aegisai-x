import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, HelpCircle, ShieldAlert, Zap, Cpu } from 'lucide-react';

interface TimelineEvent {
  id: string;
  agent: string;
  action: string;
  timestamp: string;
  type: 'heal' | 'security' | 'investigate' | 'info';
  details: string;
}

const initialEvents: TimelineEvent[] = [
  {
    id: '1',
    agent: 'Incident Investigator Agent',
    action: 'Restarted Auth-Service container pods on Cluster-US-West',
    timestamp: '3 mins ago',
    type: 'heal',
    details: 'Detected container crash loops due to memory leaks. Auto-healing protocol trigged pod scale-out to prevent service unavailability. Root cause identified as node thrashing.'
  },
  {
    id: '2',
    agent: 'Security Agent',
    action: 'Revoked compromise token and updated IAM policy',
    timestamp: '20 mins ago',
    type: 'security',
    details: 'Identified API requests containing deprecated signature formats. Terminated keys, notified primary admin, and applied rotating token rules.'
  },
  {
    id: '3',
    agent: 'Cost Agent',
    action: 'Identified 3 underutilized databases in Staging cluster',
    timestamp: '1 hour ago',
    type: 'info',
    details: 'Staging DB RDS instances running at <3% CPU over 14 days. Recommending downscaling from db.t3.medium to db.t3.micro. Est. monthly savings: $320.'
  },
  {
    id: '4',
    agent: 'Reliability Agent',
    action: 'Resolved network packet drops on Edge routing',
    timestamp: '2 hours ago',
    type: 'heal',
    details: 'DNS resolution times spiked on route-53 entry points. Configured cloudflare fallback caching rules to stabilize gateway responses.'
  }
];

export default function ActivityTimeline() {
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedEventId(expandedEventId === id ? null : id);
  };

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'heal':
        return <Zap size={15} className="text-brand-success" />;
      case 'security':
        return <ShieldAlert size={15} className="text-brand-accent" />;
      case 'investigate':
        return <Cpu size={15} className="text-brand-primary" />;
      default:
        return <HelpCircle size={15} className="text-brand-textSecondary" />;
    }
  };

  const getBadgeColor = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'heal': return 'bg-brand-success/10 border-brand-success/20';
      case 'security': return 'bg-brand-accent/10 border-brand-accent/20';
      case 'investigate': return 'bg-brand-primary/10 border-brand-primary/20';
      default: return 'bg-slate-100 border-slate-200';
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft">
      <div className="flex items-center justify-between pb-4 border-b border-slate-50 mb-5">
        <div>
          <h3 className="font-bold text-brand-textPrimary text-sm">Self-Healing Log</h3>
          <p className="text-xs text-brand-textSecondary">Autonomous operations timeline</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-brand-textSecondary">
          <Clock size={12} />
          <span>Real-time feeds</span>
        </div>
      </div>

      <div className="relative border-l border-slate-100 ml-4 pl-6 space-y-6 pb-2">
        {initialEvents.map((event) => {
          const isExpanded = expandedEventId === event.id;
          return (
            <div key={event.id} className="relative">
              {/* Vertical node circle */}
              <div className={`absolute -left-[32px] top-0.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center shadow-soft ${getBadgeColor(event.type)}`}>
                {getEventIcon(event.type)}
              </div>

              {/* Event Body */}
              <div className="space-y-1">
                <div className="flex justify-between items-start gap-4">
                  <div className="text-xs font-bold text-brand-textPrimary">
                    {event.agent}
                  </div>
                  <span className="text-[10px] text-brand-textSecondary whitespace-nowrap">
                    {event.timestamp}
                  </span>
                </div>
                
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {event.action}
                </p>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-brand-textSecondary leading-relaxed animate-in fade-in slide-in-from-top-1 duration-150">
                    {event.details}
                  </div>
                )}

                <button
                  onClick={() => toggleExpand(event.id)}
                  className="flex items-center gap-1 text-[10px] text-brand-primary hover:underline font-semibold mt-1"
                >
                  <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                  {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
