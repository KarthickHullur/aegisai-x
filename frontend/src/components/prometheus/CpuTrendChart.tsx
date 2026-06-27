import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface DataPoint {
  time: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  loading: boolean;
}

export default function CpuTrendChart({ data, loading }: Props) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft h-[320px] flex flex-col justify-between">
      <div>
        <h3 className="font-bold text-slate-800 text-sm">CPU Utilization Trend</h3>
        <p className="text-[10px] text-slate-400">Average container CPU cores rate in %</p>
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
                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5B5FFB" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#5B5FFB" stopOpacity={0.0} />
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
                formatter={(value: any) => [`${Number(value).toFixed(2)}%`, 'CPU Usage']}
              />
              <Area type="monotone" dataKey="value" stroke="#5B5FFB" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" name="CPU Usage" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
