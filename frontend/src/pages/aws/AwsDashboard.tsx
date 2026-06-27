import { useEffect, useState } from 'react';
import { 
  getAwsStatus, 
  getAwsResources, 
  getAwsSecurity, 
  getAwsRecommendations, 
  getAwsIAM,
  getAwsRegions,
  AwsStatus, 
  AwsResource, 
  AwsSecurityFinding, 
  AwsRecommendation,
  AwsIAMData,
  AwsRegion
} from '../../services/api';
import AwsStatusCard from '../../components/aws/AwsStatusCard';
import AwsOverview from '../../components/aws/AwsOverview';
import AwsResources from '../../components/aws/AwsResources';
import AwsSecurity from '../../components/aws/AwsSecurity';
import AwsRecommendations from '../../components/aws/AwsRecommendations';
import { AlertCircle } from 'lucide-react';

export default function AwsDashboard() {
  const [status, setStatus] = useState<AwsStatus | null>(null);
  const [resources, setResources] = useState<AwsResource[]>([]);
  const [regions, setRegions] = useState<AwsRegion[]>([]);
  const [iamData, setIamData] = useState<AwsIAMData | null>(null);
  const [findings, setFindings] = useState<AwsSecurityFinding[]>([]);
  const [recommendations, setRecommendations] = useState<AwsRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, res, iam, find, rec, regs] = await Promise.all([
        getAwsStatus(),
        getAwsResources(),
        getAwsIAM(),
        getAwsSecurity(),
        getAwsRecommendations(),
        getAwsRegions()
      ]);
      setStatus(s);
      setResources(res);
      setIamData(iam);
      setFindings(find);
      setRecommendations(rec);
      setRegions(regs);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch AWS dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSync = () => {
    fetchData();
  };

  const isConnected = status?.connected || false;

  // Filter resource statistics based on connection status
  const activeResources = resources.filter((r) => r.isLive === isConnected);
  const activeRegions = regions.filter((r) => r.isLive === isConnected);
  
  const ec2Count = activeResources.filter((r) => r.type === 'EC2 Instance').length;
  const s3Count = activeResources.filter((r) => r.type === 'S3 Bucket').length;
  const vpcCount = activeResources.filter((r) => r.type === 'VPC').length;
  
  const activeUsers = iamData?.users.filter((u) => u.isLive === isConnected) || [];
  const activeRoles = iamData?.roles.filter((r) => r.isLive === isConnected) || [];
  
  const stats = {
    ec2: ec2Count,
    s3: s3Count,
    vpc: vpcCount,
    users: activeUsers.length,
    roles: activeRoles.length,
    regions: activeRegions.length
  };

  const isLiveEmpty = isConnected && (ec2Count === 0 && s3Count === 0 && vpcCount === 0);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-800">
          AWS Operations Console
        </h1>
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-0.5">
          Observability, security posture, and SRE co-management.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-800 text-sm font-medium">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Connection status card */}
      <AwsStatusCard status={status} loading={loading} onSync={handleSync} />

      {/* Empty live banner alert */}
      {isLiveEmpty && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-3xl flex items-start gap-3.5 text-amber-900 text-sm">
          <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-950">No live resources discovered.</h4>
            <p className="text-xs text-amber-800/85 mt-0.5">
              The live AWS connection succeeded, but returned 0 active EC2 instances, S3 buckets, and VPC networks in the configured account.
            </p>
          </div>
        </div>
      )}

      {/* Summary counters */}
      <AwsOverview stats={stats} />

      {/* Main dashboard content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resource Explorer & Actions */}
        <div className="lg:col-span-2 space-y-6">
          <AwsResources resources={resources} />
          <AwsRecommendations recommendations={recommendations} />
        </div>

        {/* Security Posture findings */}
        <div className="space-y-6">
          <AwsSecurity findings={findings} />
        </div>
      </div>
    </div>
  );
}
