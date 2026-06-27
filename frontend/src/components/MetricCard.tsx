import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface MetricCardProps {
  title: string;
  value: string | number;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  chartData?: { value: number }[];
  chartColor?: string;
  onClick?: () => void;
}

export default function MetricCard({
  title,
  value,
  change,
  changeType,
  icon,
  chartData = [{ value: 30 }, { value: 40 }, { value: 35 }, { value: 50 }, { value: 49 }, { value: 60 }, { value: 70 }],
  chartColor = '#5B5FFB',
  onClick,
}: MetricCardProps) {
  const isPositive = changeType === 'positive';
  const isNegative = changeType === 'negative';

  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 border border-slate-100 shadow-soft hover:shadow-premium transition-all duration-300 flex flex-col justify-between h-[155px] group ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between">
        {/* Metric Title & Value */}
        <div className="space-y-1">
          <span className="text-xs font-semibold text-brand-textSecondary tracking-wide uppercase">
            {title}
          </span>
          <div className="text-2xl font-bold text-brand-textPrimary tracking-tight">
            {value}
          </div>
        </div>

        {/* Icon Container */}
        <div className="p-2.5 rounded-xl bg-slate-50 text-brand-textSecondary group-hover:bg-brand-primary/5 group-hover:text-brand-primary transition-colors duration-300">
          {icon}
        </div>
      </div>

      {/* Sparkline & Trend Info */}
      <div className="flex items-end justify-between mt-3 gap-4">
        {/* Trend badge */}
        <div className="flex items-center gap-1">
          <span
            className={`
              flex items-center text-xs font-bold px-2 py-0.5 rounded-lg
              ${isPositive && 'bg-brand-success/10 text-brand-success'}
              ${isNegative && 'bg-brand-danger/10 text-brand-danger'}
              ${changeType === 'neutral' && 'bg-slate-100 text-brand-textSecondary'}
            `}
          >
            {isPositive && <ArrowUpRight size={14} className="mr-0.5" />}
            {isNegative && <ArrowDownRight size={14} className="mr-0.5" />}
            {change}
          </span>
        </div>

        {/* Sparkline visualization */}
        {chartData && (
          <div className="h-10 w-24 sm:w-28 opacity-75 group-hover:opacity-100 transition-opacity duration-300">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={chartColor}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={`url(#gradient-${title})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
