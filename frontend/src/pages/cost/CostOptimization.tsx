import { useState } from 'react';
import { 
  DollarSign, 
  TrendingDown, 
  Zap, 
  RefreshCw,
  Percent
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip,
  Legend 
} from 'recharts';

interface CostOpportunity {
  id: string;
  resource: string;
  type: string;
  wasteReason: string;
  recommendation: string;
  savings: number;
  status: 'pending' | 'applied';
}

const mockOpportunities: CostOpportunity[] = [
  { id: '1', resource: 'staging-rds-postgres', type: 'Database', wasteReason: 'CPU utilization <3% for 14 days', recommendation: 'Downscale from db.t3.medium to db.t3.micro', savings: 320, status: 'pending' },
  { id: '2', resource: 'vol-09ea382b9a7c', type: 'Storage', wasteReason: 'Detached EBS Volume, unattached for 30 days', recommendation: 'Delete detached EBS volume', savings: 45, status: 'pending' },
  { id: '3', resource: 'k8s-perf-testing-pool', type: 'Compute Set', wasteReason: 'Idle replica pool over weekend', recommendation: 'Configure weekend scale-down rule', savings: 740, status: 'pending' },
  { id: '4', resource: 's3-analytics-raw-temp', type: 'Object Cache', wasteReason: 'No lifecycle rule configured', recommendation: 'Transition to Glacier Deep Archive after 7 days', savings: 120, status: 'applied' }
];

const wasteData = [
  { name: 'Unused Databases', value: 320 },
  { name: 'Detached Volumes', value: 45 },
  { name: 'Idle Compute Node Pools', value: 740 },
  { name: 'Objects Cache', value: 120 },
];

const COLORS = ['#5B5FFB', '#8B5CF6', '#EC4899', '#10B981'];

export default function CostOptimization() {
  const [opportunities, setOpportunities] = useState<CostOpportunity[]>(mockOpportunities);
  const [totalEstimatedSavings, setTotalEstimatedSavings] = useState(
    mockOpportunities.reduce((acc, curr) => curr.status === 'pending' ? acc + curr.savings : acc, 0)
  );

  const handleApply = (id: string) => {
    setOpportunities(prev => 
      prev.map(opp => {
        if (opp.id === id) {
          setTotalEstimatedSavings(old => old - opp.savings);
          return { ...opp, status: 'applied' };
        }
        return opp;
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Cost & FinOps Optimization</h1>
        <p className="text-sm text-brand-textSecondary">
          Identify underutilized database instances, unattached disks, and configure auto-scaling cost limits.
        </p>
      </div>

      {/* Savings Info Cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">Potential Savings</span>
            <DollarSign size={18} className="text-brand-success" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">${totalEstimatedSavings}/mo</div>
            <p className="text-[10px] text-brand-success font-semibold mt-0.5">Ready for auto-applying</p>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">Active Waste Count</span>
            <TrendingDown size={18} className="text-brand-warning" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">3 Items</div>
            <p className="text-[10px] text-brand-textSecondary font-semibold mt-0.5">Compute, databases & disks</p>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">Efficiency Index</span>
            <Percent size={18} className="text-brand-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">84%</div>
            <p className="text-[10px] text-brand-success font-semibold mt-0.5">+5% optimized this month</p>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">Applied Savings</span>
            <Zap size={18} className="text-brand-secondary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">$4,280/mo</div>
            <p className="text-[10px] text-brand-success font-semibold mt-0.5">Target metric limit achieved</p>
          </div>
        </div>
      </section>

      {/* Waste Analysis */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Waste Breakdown Pie Chart */}
        <div className="lg:col-span-1 bg-white border border-slate-100 rounded-2xl p-5 shadow-soft flex flex-col justify-between">
          <div className="pb-3 border-b border-slate-50">
            <h3 className="font-bold text-brand-textPrimary text-xs">Wastage Distribution</h3>
            <p className="text-[10px] text-brand-textSecondary">Monthly cost analysis by category</p>
          </div>

          <div className="h-56 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={wasteData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {wasteData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value}`} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 9 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cost Optimization Recommendations */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-brand-textPrimary text-xs">Cost Optimization Opportunities</h3>
              <p className="text-[10px] text-brand-textSecondary">Recommendations generated by Cost Agent</p>
            </div>
            <button className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-brand-textSecondary tracking-wider uppercase">
                  <th className="py-3.5 px-6">Resource ID</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Observation</th>
                  <th className="py-3.5 px-4 text-right">Est. Savings</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {opportunities.map((opp) => (
                  <tr key={opp.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 px-6 font-mono font-bold text-slate-900 text-xs truncate max-w-[150px]">
                      {opp.resource}
                    </td>

                    <td className="py-4 px-4 font-semibold text-brand-textPrimary">
                      {opp.type}
                    </td>

                    <td className="py-4 px-4 font-medium text-brand-textSecondary text-xs">
                      <div>{opp.wasteReason}</div>
                      <span className="text-[10px] text-brand-primary italic">{opp.recommendation}</span>
                    </td>

                    <td className="py-4 px-4 font-bold text-brand-success text-right">
                      ${opp.savings}/mo
                    </td>

                    <td className="py-4 px-6 text-right">
                      {opp.status === 'pending' ? (
                        <button
                          onClick={() => handleApply(opp.id)}
                          className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl text-xs shadow-soft transition-all"
                        >
                          Auto-Scale
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-brand-success bg-brand-success/10 px-2.5 py-1 rounded-full border border-brand-success/20">
                          Applied
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
