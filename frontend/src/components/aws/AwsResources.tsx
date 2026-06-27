import { useState } from 'react';
import { AwsResource } from '../../services/api';
import { Search, Filter, Globe } from 'lucide-react';

interface AwsResourcesProps {
  resources: AwsResource[];
}

export default function AwsResources({ resources }: AwsResourcesProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'live' | 'demo'>('all');

  const filtered = resources.filter((r) => {
    // 1. Connection filter
    if (filter === 'live' && !r.isLive) return false;
    if (filter === 'demo' && r.isLive) return false;

    // 2. Search query filter
    const query = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(query) ||
      r.id.toLowerCase().includes(query) ||
      r.type.toLowerCase().includes(query) ||
      r.region.toLowerCase().includes(query)
    );
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">AWS Resource Explorer</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Query and monitor infrastructure objects in real-time.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search resources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-50 border border-slate-150 text-slate-700 text-xs px-4 py-2.5 pl-10 rounded-2xl outline-none w-56 focus:ring-1 focus:ring-brand-primary focus:bg-white transition-all"
            />
          </div>

          {/* Filter dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 rounded-2xl px-3.5 py-2">
            <Filter size={14} className="text-slate-500" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="bg-transparent border-none text-slate-700 text-xs font-semibold outline-none cursor-pointer"
            >
              <option value="all">Combined</option>
              <option value="live">Live Only</option>
              <option value="demo">Demo Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Region</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Origin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length > 0 ? (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors duration-150">
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-800 text-sm block truncate max-w-[280px]">
                      {r.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[280px] mt-0.5">
                      {r.id}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-semibold text-slate-500">
                    {r.type}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-2">
                    <Globe size={12} className="text-slate-400" />
                    {r.region}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                      r.status === 'running' || r.status === 'available' || r.status === 'Succeeded' || r.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : r.status === 'stopped' || r.status === 'degraded' || r.status === 'Public'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-50 text-slate-700'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      r.isLive 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {r.isLive ? 'Live' : 'Demo'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm font-medium text-slate-400">
                  No resources discovered matching criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
