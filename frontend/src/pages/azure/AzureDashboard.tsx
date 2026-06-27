import { useState, useEffect } from 'react';
import {
  Cloud,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Server,
  HardDrive,
  Cpu,
  Layers,
  Folder,
  DollarSign,
  ShieldAlert,
  Search,
  Zap,
  BookOpen,
  ArrowRight,
  Activity,
  Globe
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import {
  getAzureStatus,
  getAzureSubscriptions,
  getAzureResourceGroups,
  getAzureVMs,
  getAzureStorage,
  getAzureAKS,
  getAzureResources,
  getAzureSecurity,
  getAzureCosts,
  getAzureRecommendations,
  getAzureProviders,
  AzureStatus,
  AzureSubscription,
  AzureResourceGroup,
  AzureVM,
  AzureStorageAccount,
  AzureAKSCluster,
  AzureResource,
  AzureSecurityFinding,
  AzureCost,
  AzureRecommendation,
  AzureProvider
} from '../../services/api';

export default function AzureDashboard() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AzureStatus | null>(null);
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [resourceGroups, setResourceGroups] = useState<AzureResourceGroup[]>([]);
  const [providers, setProviders] = useState<AzureProvider[]>([]);
  const [vms, setVms] = useState<AzureVM[]>([]);
  const [storageAccounts, setStorageAccounts] = useState<AzureStorageAccount[]>([]);
  const [aksClusters, setAksClusters] = useState<AzureAKSCluster[]>([]);
  const [resources, setResources] = useState<AzureResource[]>([]);
  const [securityFindings, setSecurityFindings] = useState<AzureSecurityFinding[]>([]);
  const [costs, setCosts] = useState<AzureCost[]>([]);
  const [recommendations, setRecommendations] = useState<AzureRecommendation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [explorerFilter, setExplorerFilter] = useState<'all' | 'live' | 'demo'>('all');

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [
        resStatus,
        resSubs,
        resRGs,
        resVMs,
        resStorage,
        resAKS,
        resResources,
        resSecurity,
        resCosts,
        resRecs,
        resProviders
      ] = await Promise.all([
        getAzureStatus().catch(() => ({ connected: false, error: 'Status API failure', lastUpdated: new Date().toISOString() })),
        getAzureSubscriptions().catch(() => []),
        getAzureResourceGroups().catch(() => []),
        getAzureVMs().catch(() => []),
        getAzureStorage().catch(() => []),
        getAzureAKS().catch(() => []),
        getAzureResources().catch(() => []),
        getAzureSecurity().catch(() => []),
        getAzureCosts().catch(() => []),
        getAzureRecommendations().catch(() => []),
        getAzureProviders().catch(() => [])
      ]);

      setStatus(resStatus);
      setSubscriptions(resSubs);
      setResourceGroups(resRGs);
      setVms(resVMs);
      setStorageAccounts(resStorage);
      setAksClusters(resAKS);
      setResources(resResources);
      setSecurityFindings(resSecurity);
      setCosts(resCosts);
      setRecommendations(resRecs);
      setProviders(resProviders);
    } catch (err) {
      console.error('Error fetching Azure dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const activeVMs = status?.connected ? vms.filter(v => v.isLive) : vms.filter(v => !v.isLive);
  const activeStorageAccounts = status?.connected ? storageAccounts.filter(s => s.isLive) : storageAccounts.filter(s => !s.isLive);
  const activeAksClusters = status?.connected ? aksClusters.filter(a => a.isLive) : aksClusters.filter(a => !a.isLive);
  const activeResourceGroups = status?.connected ? resourceGroups.filter(rg => rg.isLive) : resourceGroups.filter(rg => !rg.isLive);
  const activeSubscriptions = status?.connected ? subscriptions.filter(sub => sub.isLive) : subscriptions.filter(sub => !sub.isLive);
  const activeProviders = status?.connected ? providers.filter(p => p.isLive) : providers.filter(p => !p.isLive);

  const hasNoResources = activeVMs.length === 0 && activeStorageAccounts.length === 0 && activeAksClusters.length === 0;

  const filteredResources = resources.filter(res => {
    const matchesSearch = res.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.status.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (explorerFilter === 'live') return res.isLive;
    if (explorerFilter === 'demo') return !res.isLive;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <Cloud className="text-brand-primary" />
            Azure Multi-Cloud Dashboard
          </h1>
          <p className="text-sm text-brand-textSecondary">
            Monitor Azure infrastructure state, resource topologies, active security posture, FinOps budgets, and runbooks.
          </p>
        </div>
        <button 
          onClick={fetchAllData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold rounded-xl text-sm shadow-soft transition-all duration-200"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing...' : 'Sync Now'}
        </button>
      </div>

      {/* Connection State Card */}
      {status && (
        <div className={`p-5 rounded-2xl border ${status.connected ? 'bg-emerald-50/40 border-emerald-100' : 'bg-amber-50/40 border-amber-100'} shadow-soft transition-all`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${status.connected ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                {status.connected ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  Azure Status: {status.connected ? 'Connected' : 'Degraded Mode'}
                </h3>
                <p className="text-xs text-brand-textSecondary mt-0.5">
                  {status.connected 
                    ? `Authenticated via CLI / Service Principal. Active subscription: ${status.subscription || 'N/A'}`
                    : `Authentication credentials unavailable. Using cached PostgreSQL snapshot data.`}
                </p>
                {status.connected && hasNoResources && (
                  <p className="text-xs text-brand-textSecondary font-bold text-slate-500 mt-1">
                    No live resources discovered.
                  </p>
                )}
                {status.error && !status.connected && (
                  <p className="text-[10px] text-amber-700 bg-amber-100/50 px-2.5 py-1.5 rounded-lg mt-2 font-mono max-w-full break-words">
                    {status.error}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] block font-bold text-brand-textSecondary uppercase">Last Sync</span>
              <span className="text-xs font-semibold text-slate-800">
                {status.lastUpdated ? new Date(status.lastUpdated).toLocaleTimeString() : 'Never'}
              </span>
            </div>
          </div>
          {status.connected && hasNoResources && (
            <div className="mt-4 p-3.5 bg-slate-50/80 border border-slate-100 rounded-xl text-xs text-brand-textSecondary">
              <strong>Notes:</strong> No live resources discovered.
            </div>
          )}
        </div>
      )}

      {/* Counts Overview grid */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-5">
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">Subscriptions</span>
            <Layers size={18} className="text-brand-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">{activeSubscriptions.length}</div>
            <p className="text-[10px] text-brand-textSecondary mt-0.5">Connected Tenants</p>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">Resource Groups</span>
            <Folder size={18} className="text-indigo-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">{activeResourceGroups.length}</div>
            <p className="text-[10px] text-brand-textSecondary mt-0.5">Logical Containers</p>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">Providers</span>
            <Globe size={18} className="text-teal-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">{activeProviders.length}</div>
            <p className="text-[10px] text-brand-textSecondary mt-0.5">Registered Modules</p>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">Virtual Machines</span>
            <Server size={18} className="text-sky-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">{activeVMs.length}</div>
            <p className="text-[10px] text-brand-textSecondary mt-0.5">{activeVMs.filter(v => v.status.toLowerCase().includes('running') || v.status.toLowerCase().includes('healthy')).length} Active VMs</p>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">AKS Clusters</span>
            <Cpu size={18} className="text-violet-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">{activeAksClusters.length}</div>
            <p className="text-[10px] text-brand-textSecondary mt-0.5">Managed K8s Engines</p>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">Storage Accounts</span>
            <HardDrive size={18} className="text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">{activeStorageAccounts.length}</div>
            <p className="text-[10px] text-brand-textSecondary mt-0.5">Blob & File Storage</p>
          </div>
        </div>
      </section>

      {/* VM List and FinOps Cost breakdown */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost Visualizer */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-soft flex flex-col justify-between lg:col-span-1 min-h-[300px]">
          <div className="pb-3 border-b border-slate-50">
            <h3 className="font-bold text-brand-textPrimary text-xs flex items-center gap-1.5">
              <DollarSign size={14} className="text-brand-success" />
              FinOps Allocation
            </h3>
            <p className="text-[10px] text-brand-textSecondary">Azure cost consumption by Resource Group</p>
          </div>

          <div className="h-56 flex items-center justify-center mt-4">
            <ResponsiveContainer width="100%" height="100%">
              {costs.length > 0 ? (
                <PieChart>
                  <Pie
                    data={(() => {
                      const aggregated = costs.reduce((acc, curr) => {
                        acc[curr.resourceGroup] = (acc[curr.resourceGroup] || 0) + curr.cost;
                        return acc;
                      }, {} as Record<string, number>);
                      return Object.keys(aggregated).map((key) => ({
                        name: key,
                        value: Number(aggregated[key].toFixed(2))
                      }));
                    })()}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {costs.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={['#5B5FFB', '#8B5CF6', '#10B981', '#EC4899', '#F59E0B'][idx % 5]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value}`} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 9 }} />
                </PieChart>
              ) : (
                <div className="text-xs text-brand-textSecondary">No cost data available</div>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* VMs Explorer list */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-soft lg:col-span-2 overflow-hidden flex flex-col justify-between min-h-[300px]">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/40">
            <h3 className="font-bold text-brand-textPrimary text-xs flex items-center gap-1.5">
              <Activity size={14} className="text-sky-500" />
              Virtual Machines
            </h3>
            <p className="text-[10px] text-brand-textSecondary">Active Azure VM instances status & sizes</p>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-brand-textSecondary tracking-wider uppercase">
                  <th className="py-3 px-6">VM Name</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">OS Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-6 text-right">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {activeVMs.map((vm) => (
                  <tr key={vm.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-6 font-mono font-bold text-slate-900 text-xs flex items-center gap-2">
                      {vm.name}
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-sans font-extrabold ${vm.isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {vm.isLive ? 'LIVE' : 'DEMO'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-brand-textPrimary text-xs">
                      {vm.size}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-brand-textSecondary">
                      {vm.osType}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        vm.status.toLowerCase().includes('running') || vm.status.toLowerCase().includes('healthy')
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${vm.status.toLowerCase().includes('running') || vm.status.toLowerCase().includes('healthy') ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {vm.status}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-xs text-brand-textSecondary text-right">
                      {vm.location}
                    </td>
                  </tr>
                ))}
                {activeVMs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-brand-textSecondary">
                      No virtual machines found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Global Resource Explorer & Registered Providers */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Global Resource Explorer */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-soft overflow-hidden lg:col-span-2">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-brand-textPrimary text-xs">Resource Explorer</h3>
              <p className="text-[10px] text-brand-textSecondary">Global inventory of active cloud workloads</p>
            </div>
            
            <div className="flex items-center gap-3">
              <select
                value={explorerFilter}
                onChange={(e) => setExplorerFilter(e.target.value as 'all' | 'live' | 'demo')}
                className="bg-slate-50 border border-slate-200 focus:border-slate-300 focus:bg-white focus:outline-none rounded-xl text-xs py-1.5 px-3 font-semibold text-slate-700 transition-all cursor-pointer"
              >
                <option value="all">Combined</option>
                <option value="live">Live Only</option>
                <option value="demo">Demo Only</option>
              </select>

              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-full bg-slate-50 border border-slate-100 focus:border-slate-200 focus:bg-white focus:outline-none rounded-xl text-xs transition-all font-medium text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-brand-textSecondary tracking-wider uppercase">
                  <th className="py-3.5 px-6">Name</th>
                  <th className="py-3.5 px-4">Resource Type</th>
                  <th className="py-3.5 px-4">Resource Group</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-6 text-right">Provisioning Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredResources.map((res) => {
                  const parts = res.id.split('/');
                  const rgName = parts.length >= 5 ? parts[4] : 'N/A';
                  return (
                    <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-6 font-mono font-bold text-slate-900 text-xs flex items-center gap-2">
                        {res.name}
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-sans font-extrabold ${res.isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {res.isLive ? 'LIVE' : 'DEMO'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-brand-textPrimary text-xs flex items-center gap-1.5">
                        {res.type === 'Virtual Machine' && <Server size={14} className="text-sky-500" />}
                        {res.type === 'Storage Account' && <HardDrive size={14} className="text-emerald-500" />}
                        {res.type === 'AKS Cluster' && <Cpu size={14} className="text-violet-500" />}
                        {res.type}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-brand-textSecondary">
                        {rgName}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-brand-textSecondary">
                        {res.location}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          res.status === 'Available' || res.status === 'Succeeded' || res.status.toLowerCase().includes('running') || res.status.toLowerCase().includes('healthy')
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {res.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredResources.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-brand-textSecondary">
                      No resources found matching the search query
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Registered Providers */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-soft overflow-hidden lg:col-span-1 flex flex-col h-full min-h-[350px]">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/40">
            <h3 className="font-bold text-brand-textPrimary text-xs flex items-center gap-1.5">
              <Globe size={14} className="text-teal-500" />
              Registered Providers
            </h3>
            <p className="text-[10px] text-brand-textSecondary">Active Azure API resource namespaces</p>
          </div>
          <div className="overflow-y-auto max-h-[380px] divide-y divide-slate-100 flex-1">
            {activeProviders.map((provider) => (
              <div key={provider.namespace} className="p-4 flex justify-between items-center hover:bg-slate-50/30 transition-colors">
                <span className="font-mono text-slate-800 text-xs font-semibold truncate max-w-[180px] flex items-center gap-1.5" title={provider.namespace}>
                  {provider.namespace}
                  <span className={`text-[8px] px-1 py-0.2 rounded font-sans font-extrabold ${provider.isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {provider.isLive ? 'LIVE' : 'DEMO'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  {provider.registrationState}
                </span>
              </div>
            ))}
            {activeProviders.length === 0 && (
              <div className="py-8 text-center text-xs text-brand-textSecondary">
                No providers registered
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Security Defender & AI Recommendations */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Findings */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/40">
            <h3 className="font-bold text-brand-textPrimary text-xs flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-brand-danger" />
              Azure Defender Audits
            </h3>
            <p className="text-[10px] text-brand-textSecondary">Compliance & threat violations detected in Azure subscriptions</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-brand-textSecondary tracking-wider uppercase">
                  <th className="py-3 px-6">Severity</th>
                  <th className="py-3 px-4">Resource</th>
                  <th className="py-3 px-4">Audit Violation & Fix</th>
                  <th className="py-3 px-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {securityFindings.map((finding) => (
                  <tr key={finding.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-6">
                      <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                        finding.severity === 'Critical' || finding.severity === 'High'
                          ? 'bg-rose-50 text-rose-700 border border-rose-100'
                          : finding.severity === 'Medium'
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : 'bg-sky-50 text-sky-700 border border-sky-100'
                      }`}>
                        {finding.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-800 text-xs font-semibold">
                      {finding.resource}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-semibold text-brand-textPrimary">{finding.recommendation}</div>
                    </td>
                    <td className="py-3 px-6 text-right text-xs font-bold text-rose-600">
                      {finding.status}
                    </td>
                  </tr>
                ))}
                {securityFindings.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-brand-textSecondary">
                      No security findings reported
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/40">
            <h3 className="font-bold text-brand-textPrimary text-xs flex items-center gap-1.5">
              <Zap size={14} className="text-violet-500" />
              SRE AI Recommendations & Runbooks
            </h3>
            <p className="text-[10px] text-brand-textSecondary">Autogenerated operations playbooks for Azure resources</p>
          </div>

          <div className="divide-y divide-slate-100">
            {status?.subscription?.toLowerCase().includes('student') && (
              <div className="p-5 bg-violet-50/20 border-b border-violet-100">
                <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">Azure for Students detected</span>
                <p className="text-xs text-brand-textPrimary font-semibold mt-1">Recommendations:</p>
                <ul className="list-disc list-inside text-xs text-brand-textSecondary mt-1.5 space-y-1">
                  <li>Continue using Resource Groups for testing.</li>
                  <li>Use read-only discovery APIs.</li>
                  <li>Use demo mode when resources are unavailable.</li>
                  <li>Create resources only when subscription policies permit.</li>
                </ul>
              </div>
            )}
            
            {recommendations.filter(r => !r.id.startsWith('rec-student-')).map((rec) => (
              <div key={rec.id} className="p-5 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:bg-slate-50/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-500 shrink-0">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{rec.resource}</span>
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {rec.category}
                      </span>
                    </div>
                    <p className="text-xs text-brand-textPrimary font-medium mt-1">
                      {rec.recommendation}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                  <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded ${
                    rec.impact === 'High' 
                      ? 'bg-rose-50 text-rose-700' 
                      : rec.impact === 'Medium' 
                      ? 'bg-amber-50 text-amber-700' 
                      : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {rec.impact} Impact
                  </span>
                  <button className="flex items-center gap-1 text-xs font-bold text-brand-primary hover:text-brand-primary/80 transition-all">
                    Investigate
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
            {recommendations.length === 0 && (
              <div className="py-8 text-center text-xs text-brand-textSecondary">
                No recommendations available
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
