import { Server, Database, Network, Users, ShieldAlert, Globe } from 'lucide-react';

interface AwsOverviewProps {
  stats: {
    ec2: number;
    s3: number;
    vpc: number;
    users: number;
    roles: number;
    regions: number;
  };
}

export default function AwsOverview({ stats }: AwsOverviewProps) {
  const cards = [
    { name: 'Regions', value: stats.regions, icon: Globe, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
    { name: 'IAM Users', value: stats.users, icon: Users, color: 'text-sky-600 bg-sky-50 border-sky-100' },
    { name: 'S3 Buckets', value: stats.s3, icon: Database, color: 'text-amber-600 bg-amber-50 border-amber-100' },
    { name: 'VPCs', value: stats.vpc, icon: Network, color: 'text-teal-600 bg-teal-50 border-teal-100' },
    { name: 'EC2 Instances', value: stats.ec2, icon: Server, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
    { name: 'IAM Roles', value: stats.roles, icon: ShieldAlert, color: 'text-rose-600 bg-rose-50 border-rose-100' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.name}
            className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-xl border ${c.color}`}>
                <Icon size={20} />
              </div>
            </div>
            <div>
              <span className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">
                {c.name}
              </span>
              <span className="block text-3xl font-extrabold text-slate-800 mt-1 font-mono">
                {c.value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
