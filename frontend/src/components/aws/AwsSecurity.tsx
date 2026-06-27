import { AwsSecurityFinding } from '../../services/api';
import { ShieldAlert, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';

interface AwsSecurityProps {
  findings: AwsSecurityFinding[];
}

export default function AwsSecurity({ findings }: AwsSecurityProps) {
  // Count severity stats
  const counts = findings.reduce(
    (acc, f) => {
      const sev = f.severity.toLowerCase();
      if (sev === 'critical') acc.critical++;
      else if (sev === 'high') acc.high++;
      else if (sev === 'medium') acc.medium++;
      else if (sev === 'low') acc.low++;
      else acc.info++;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );

  const statCards = [
    { name: 'Critical', value: counts.critical, color: 'border-rose-100 bg-rose-50/40 text-rose-700' },
    { name: 'High', value: counts.high, color: 'border-orange-100 bg-orange-50/40 text-orange-700' },
    { name: 'Medium', value: counts.medium, color: 'border-amber-100 bg-amber-50/40 text-amber-700' },
    { name: 'Low', value: counts.low, color: 'border-indigo-100 bg-indigo-50/40 text-indigo-700' },
    { name: 'Informational', value: counts.info, color: 'border-slate-100 bg-slate-50/40 text-slate-700' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((s) => (
          <div
            key={s.name}
            className={`border rounded-2xl p-4 flex flex-col justify-between ${s.color}`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-85">
              {s.name}
            </span>
            <span className="text-2xl font-extrabold block mt-2 font-mono leading-none">
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Findings table */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="font-bold text-slate-800 text-lg">Cloud Security Posture (CSPM) Findings</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Real-time compliance checks across IAM roles, security configurations, and public assets.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Affected Resource</th>
                <th className="py-3 px-4">Recommendation Details</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {findings.length > 0 ? (
                findings.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/30 transition-colors duration-150">
                    <td className="py-4 px-4 align-top">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        f.severity === 'Critical'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : f.severity === 'High'
                          ? 'bg-orange-100 text-orange-800 border border-orange-200'
                          : f.severity === 'Medium'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {f.severity === 'Critical' ? <ShieldAlert size={10} /> : <AlertCircle size={10} />}
                        {f.severity}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-700 text-sm align-top">
                      {f.resource}
                    </td>
                    <td className="py-4 px-4 text-xs font-medium text-slate-500 max-w-[400px] leading-relaxed align-top">
                      {f.recommendation}
                    </td>
                    <td className="py-4 px-4 text-right align-top">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        f.status === 'Open'
                          ? 'bg-rose-50 text-rose-700'
                          : f.status === 'Resolved' || f.status === 'Closed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-50 text-slate-700'
                      }`}>
                        {f.status === 'Open' ? <AlertTriangle size={10} /> : <CheckCircle size={10} />}
                        {f.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-sm font-medium text-slate-400">
                    No security posture violations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
