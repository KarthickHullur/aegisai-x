import { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Key, 
  Activity 
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import StatusBadge from '../../components/StatusBadge';
import { getSecurity } from '../../services/api';

interface Vulnerability {
  id: string;
  cve: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  component: string;
  status: 'open' | 'patching' | 'resolved';
}

const mockVulns: Vulnerability[] = [
  { id: '1', cve: 'CVE-2024-21626', severity: 'critical', title: 'Container runc escape vulnerability', component: 'K8s Base Node Engine', status: 'patching' },
  { id: '2', cve: 'CVE-2023-44487', severity: 'high', title: 'HTTP/2 Rapid Reset DDoS vulnerability', component: 'Ingress Nginx Gateway', status: 'open' },
  { id: '3', cve: 'CVE-2024-0402', severity: 'medium', title: 'OpenSSL buffer overflow risk in payload certs', component: 'Auth-Service image', status: 'resolved' },
  { id: '4', cve: 'CVE-2023-38545', severity: 'low', title: 'curl SOCKS5 proxy heap buffer overflow', component: 'Reliability Agent runtime', status: 'resolved' }
];

const riskCategories = [
  { name: 'Identity/IAM', count: 2, limit: 10 },
  { name: 'Network Ports', count: 0, limit: 10 },
  { name: 'Certificates', count: 1, limit: 10 },
  { name: 'OS Packages', count: 4, limit: 10 },
  { name: 'Storage Config', count: 1, limit: 10 },
];

export default function SecurityCenter() {
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [securityScore, setSecurityScore] = useState<number>(98);
  const [compliance, setCompliance] = useState<any>({
    soc2: 'compliant',
    iso27001: 'compliant',
    hipaa: 'compliant',
    cis_bench: '92%',
  });
  const [keyRotations, setKeyRotations] = useState<any>({
    active_rotations: 42,
    expired_keys: 0,
    status: 'Optimal',
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  useEffect(() => {
    const fetchSecurityData = async () => {
      try {
        setLoading(true);
        const res = await getSecurity();
        
        const mappedVulns: Vulnerability[] = res.vulnerabilities.map((v) => ({
          id: v.id,
          cve: v.cve,
          severity: (v.severity.toLowerCase() as Vulnerability['severity']) || 'low',
          title: v.title,
          component: v.component,
          status: (v.status.toLowerCase() as Vulnerability['status']) || 'open',
        }));

        setVulns(mappedVulns);
        setSecurityScore(res.security_score);
        setCompliance(res.compliance);
        setKeyRotations(res.key_rotations);
      } catch (err) {
        console.error('Failed to fetch security findings, using fallbacks:', err);
        setVulns(mockVulns);
      } finally {
        setLoading(false);
      }
    };

    fetchSecurityData();
  }, []);

  const filteredVulns = vulns.filter(v => 
    filterSeverity === 'all' || v.severity === filterSeverity
  );

  const triggerPatch = (id: string) => {
    setVulns(prev => 
      prev.map(v => v.id === id ? { ...v, status: 'patching' } : v)
    );
    // Simulate auto-patch completion
    setTimeout(() => {
      setVulns(prev => 
        prev.map(v => v.id === id ? { ...v, status: 'resolved' } : v)
      );
    }, 2000);
  };

  const openVulns = vulns.filter(v => v.status !== 'resolved');
  const criticalCount = openVulns.filter(v => v.severity === 'critical').length;
  const highCount = openVulns.filter(v => v.severity === 'high').length;
  const mediumCount = openVulns.filter(v => v.severity === 'medium').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-brand-textSecondary animate-pulse">Loading security findings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Security & Threat Center</h1>
        <p className="text-sm text-brand-textSecondary">
          Monitor vulnerability posture, credentials rotations, compliance levels, and active mitigations.
        </p>
      </div>

      {/* Overview Score Cards */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">Posture Score</span>
            <ShieldCheck size={18} className="text-brand-success" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">{securityScore}%</div>
            <p className="text-[10px] text-brand-success font-semibold mt-0.5">
              {compliance.soc2 === 'compliant' && compliance.iso27001 === 'compliant' 
                ? 'SOC2 & ISO Compliant' 
                : 'Compliance Audit Required'}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">Active Vulnerabilities</span>
            <ShieldAlert size={18} className="text-brand-danger" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">
              {openVulns.length} {openVulns.length === 1 ? 'Open' : 'Opens'}
            </div>
            <p className="text-[10px] text-brand-textSecondary font-semibold mt-0.5">
              {criticalCount} Critical, {highCount} High, {mediumCount} Med
            </p>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">Key Rotations</span>
            <Key size={18} className="text-brand-secondary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">
              {keyRotations.active_rotations} Rotated
            </div>
            <p className="text-[10px] text-brand-success font-semibold mt-0.5">
              Status: {keyRotations.status}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-soft flex flex-col justify-between h-[120px]">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-brand-textSecondary uppercase">Scan Latency</span>
            <Activity size={18} className="text-brand-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold text-brand-textPrimary">2m ago</div>
            <p className="text-[10px] text-brand-textSecondary font-semibold mt-0.5">Real-time daemon active</p>
          </div>
        </div>
      </section>

      {/* Charts & Risks summary */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-5 shadow-soft">
          <div className="pb-4 border-b border-slate-50 mb-5">
            <h3 className="font-bold text-brand-textPrimary text-xs">Vulnerability Distribution by Resource Category</h3>
            <p className="text-[10px] text-brand-textSecondary">Audit classifications from the Security Agent scans</p>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskCategories} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #F1F5F9' }} />
                <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Open Vulnerabilities" maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Security checklist status */}
        <div className="lg:col-span-1 bg-white border border-slate-100 rounded-2xl p-5 shadow-soft flex flex-col justify-between">
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-50">
              <h3 className="font-bold text-brand-textPrimary text-xs">Compliance Audit Checks</h3>
            </div>
            
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">Docker Image Signing policy</span>
                <span className="font-bold text-brand-success bg-brand-success/10 px-2 py-0.5 rounded-lg border border-brand-success/20">Passed</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">AWS CloudTrail log encryption</span>
                <span className="font-bold text-brand-success bg-brand-success/10 px-2 py-0.5 rounded-lg border border-brand-success/20">Passed</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">IAM wildcard policy review</span>
                <span className="font-bold text-brand-warning bg-brand-warning/10 px-2 py-0.5 rounded-lg border border-brand-warning/20">Audit Pending</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">Ingress TLS configuration v1.3</span>
                <span className="font-bold text-brand-success bg-brand-success/10 px-2 py-0.5 rounded-lg border border-brand-success/20">Passed</span>
              </div>
            </div>
          </div>

          <button className="w-full text-center py-2 bg-slate-50 hover:bg-slate-100 text-brand-textPrimary font-bold rounded-xl text-xs border border-slate-200 mt-4 transition-colors">
            Run compliance audit scan
          </button>
        </div>
      </section>

      {/* Vulnerabilities Table */}
      <section className="bg-white border border-slate-100 rounded-2xl shadow-soft overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-bold text-brand-textPrimary text-xs">Detected CVEs & Security Issues</h3>
            <p className="text-[10px] text-brand-textSecondary">Details on library flaws and microservice patches</p>
          </div>

          <div className="flex gap-2">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 outline-none hover:border-brand-primary cursor-pointer transition-colors"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/20 text-[10px] font-bold text-brand-textSecondary tracking-wider uppercase">
                <th className="py-3.5 px-6">Severity</th>
                <th className="py-3.5 px-4">CVE Reference</th>
                <th className="py-3.5 px-4">Vulnerability Detail</th>
                <th className="py-3.5 px-4">Component</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredVulns.map((vuln) => (
                <tr key={vuln.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-4 px-6">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border capitalize ${
                      vuln.severity === 'critical' ? 'bg-brand-danger/10 text-brand-danger border-brand-danger/20' :
                      vuln.severity === 'high' ? 'bg-brand-warning/10 text-brand-warning border-brand-warning/20' :
                      'bg-brand-primary/10 text-brand-primary border-brand-primary/20'
                    }`}>
                      {vuln.severity}
                    </span>
                  </td>

                  <td className="py-4 px-4 font-mono font-bold text-slate-900 text-xs">
                    {vuln.cve}
                  </td>

                  <td className="py-4 px-4 font-semibold text-brand-textPrimary">
                    {vuln.title}
                  </td>

                  <td className="py-4 px-4 text-brand-textSecondary font-semibold">
                    {vuln.component}
                  </td>

                  <td className="py-4 px-4">
                    <StatusBadge status={vuln.status} />
                  </td>

                  <td className="py-4 px-6 text-right">
                    {vuln.status !== 'resolved' && (
                      <button
                        onClick={() => triggerPatch(vuln.id)}
                        className="text-xs font-bold text-brand-primary hover:underline"
                      >
                        {vuln.status === 'patching' ? 'Deploying...' : 'Auto-Patch'}
                      </button>
                    )}
                    {vuln.status === 'resolved' && (
                      <span className="text-xs font-bold text-brand-success">Fixed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
