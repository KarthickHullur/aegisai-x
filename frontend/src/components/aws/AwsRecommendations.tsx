import { AwsRecommendation } from '../../services/api';
import { Sparkles, ArrowUpRight, Zap } from 'lucide-react';

interface AwsRecommendationsProps {
  recommendations: AwsRecommendation[];
}

export default function AwsRecommendations({ recommendations }: AwsRecommendationsProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
          <Sparkles size={20} className="animate-pulse" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 text-lg">AI-Native Optimization Recommendations</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Generative SRE recommendations mapped directly to cloud governance runbooks.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {recommendations.length > 0 ? (
          recommendations.map((r) => (
            <div
              key={r.id}
              className="border border-slate-100 rounded-2xl p-5 hover:border-slate-200 hover:shadow-sm transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-500 font-semibold text-[10px] uppercase tracking-wider">
                    {r.category}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    r.impact === 'Critical' || r.impact === 'High'
                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                      : r.impact === 'Medium'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    <Zap size={9} />
                    Impact: {r.impact}
                  </span>
                </div>

                <h4 className="font-bold text-slate-800 text-sm mb-1">
                  Optimize {r.resource}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium mt-1.5">
                  {r.recommendation}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400">
                  ID: {r.id}
                </span>
                <button className="flex items-center gap-1 text-[11px] font-bold text-brand-primary hover:text-brand-primaryHover transition-colors">
                  Run mitigation <ArrowUpRight size={12} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 py-10 text-center text-sm font-medium text-slate-400">
            No active SRE recommendations. Infrastructure is running optimally.
          </div>
        )}
      </div>
    </div>
  );
}
