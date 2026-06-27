import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface DataPoint {
  time: string;
  ingress: number;
  egress: number;
}

interface Props {
  data: DataPoint[];
  loading: boolean;
}

export default function NetworkTrendChart({ data, loading }: Props) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft h-[320px] flex flex-col justify-between">
      <div>
        <h3 className="font-bold text-slate-800 text-sm">Network Throughput</h3>
        <p className="text-[10px] text-slate-400">Total container ingress and egress rates in KB/s</p>
      </div>

      <div className="flex-1 min-h-0 mt-4 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
            <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : null}

        {data.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            No telemetry data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIngress" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorEgress" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="time" stroke="#94A3B8" fontSize={9} tickLine={false} />
              <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#FFFFFF', 
                  border: '1px solid #E2E8F0', 
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  fontSize: '11px'
                }}
                formatter={(value: any, name: string) => [`${Number(value).toFixed(1)} KB/s`, name === 'ingress' ? 'Ingress' : 'Egress']}
              />
              <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{ fontSize: '10px' }} />
              <Area type="monotone" dataKey="ingress" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorIngress)" name="Ingress" />
              <Area type="monotone" dataKey="egress" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorEgress)" name="Egress" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
