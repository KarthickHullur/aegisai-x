import { useState, useEffect } from 'react';
import { 
  Cpu, 
  Key, 
  Bell, 
  Globe, 
  Check, 
  ShieldCheck,
  Cloud,
  Server,
  RefreshCw,
  Power,
  AlertCircle,
  Database,
  UploadCloud
} from 'lucide-react';
import {
  getCloudConnections,
  connectCloudConnection,
  testCloudConnection,
  disconnectCloudConnection,
  CloudConnectionItem
} from '../../services/api';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'connections' | 'agents' | 'keys' | 'alerts'>('general');
  const [isSaved, setIsSaved] = useState(false);
  const [autopilot, setAutopilot] = useState(true);
  const [notificationsSlack, setNotificationsSlack] = useState(true);

  // Connections manager states
  const [connections, setConnections] = useState<CloudConnectionItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [providerStatuses, setProviderStatuses] = useState<Record<string, 'connected' | 'testing' | 'failed' | 'disconnected'>>({});
  
  // Docker Creds State
  const [dockerEndpoint, setDockerEndpoint] = useState('');
  
  // K8s Creds State
  const [k8sMethod, setK8sMethod] = useState<'upload' | 'paste'>('paste');
  const [k8sKubeconfig, setK8sKubeconfig] = useState('');
  
  // Azure Creds State
  const [azureMethod, setAzureMethod] = useState<'cli' | 'sp'>('cli');
  const [azureTenant, setAzureTenant] = useState('');
  const [azureClient, setAzureClient] = useState('');
  const [azureSecret, setAzureSecret] = useState('');
  const [azureSub, setAzureSub] = useState('');

  // AWS Creds State
  const [awsMethod, setAwsMethod] = useState<'cli' | 'keys'>('cli');
  const [awsAccessKey, setAwsAccessKey] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('');

  // Status & Test Results
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const loadConnections = async () => {
    try {
      const res = await getCloudConnections();
      setConnections(res.data);

      const initialStatuses: Record<string, 'connected' | 'testing' | 'failed' | 'disconnected'> = {};
      res.data.forEach(c => {
        initialStatuses[c.provider] = c.status === 'connected' ? 'connected' : 'disconnected';
      });
      setProviderStatuses(initialStatuses);
      
      // Auto-populate form fields from existing configurations metadata
      const docker = res.data.find(c => c.provider === 'docker');
      if (docker?.metadata?.endpoint) setDockerEndpoint(docker.metadata.endpoint);

      // kubeconfig is not sent back for security, so we don't auto-fill secrets

      const azure = res.data.find(c => c.provider === 'azure');
      if (azure) {
        setAzureMethod(azure.connectionType === 'service-principal' ? 'sp' : 'cli');
        if (azure.metadata?.subscriptionId) setAzureSub(azure.metadata.subscriptionId);
      }

      const aws = res.data.find(c => c.provider === 'aws');
      if (aws) {
        setAwsMethod(aws.connectionType === 'access-keys' ? 'keys' : 'cli');
        if (aws.metadata?.region) setAwsRegion(aws.metadata.region);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadConnections();
  }, [activeTab]);

  const handleTest = async (provider: string) => {
    let credentials = '';
    let connType = '';

    if (provider === 'docker') {
      connType = 'Docker Endpoint';
      credentials = JSON.stringify({ endpoint: dockerEndpoint });
    } else if (provider === 'kubernetes') {
      connType = k8sMethod === 'paste' ? 'kubeconfig-paste' : 'kubeconfig-upload';
      credentials = JSON.stringify({ kubeconfig: k8sKubeconfig });
    } else if (provider === 'azure') {
      connType = azureMethod === 'cli' ? 'cli-login' : 'service-principal';
      credentials = JSON.stringify({
        tenantId: azureTenant,
        clientId: azureClient,
        clientSecret: azureSecret,
        subscriptionId: azureSub
      });
    } else if (provider === 'aws') {
      connType = awsMethod === 'cli' ? 'cli-login' : 'access-keys';
      credentials = JSON.stringify({
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey,
        region: awsRegion
      });
    }

    setIsSyncing(provider);
    setProviderStatuses(prev => ({ ...prev, [provider]: 'testing' }));
    setStatusMessage({ type: 'info', text: `Testing connection to ${provider}...` });
    try {
      const res = await testCloudConnection(provider, connType, credentials);
      if (res.success && res.connected) {
        setProviderStatuses(prev => ({ ...prev, [provider]: 'connected' }));
        setStatusMessage({
          type: 'success',
          text: 'Connection successful'
        });
      } else {
        setProviderStatuses(prev => ({ ...prev, [provider]: 'failed' }));
        
        let errMsg = 'Connection failed';
        if (res.error) {
          const errLower = res.error.toLowerCase();
          if (errLower.includes("authentication credentials unavailable") || errLower.includes("not authenticated") || errLower.includes("credentials invalid")) {
            errMsg = 'Authentication unavailable';
          } else if (errLower.includes("unavailable") || errLower.includes("not running") || errLower.includes("connection refused") || errLower.includes("ping failed")) {
            errMsg = 'Backend unavailable';
          } else {
            errMsg = `Connection failed: ${res.error}`;
          }
        }
        setStatusMessage({
          type: 'error',
          text: errMsg
        });
      }
    } catch (e: any) {
      setProviderStatuses(prev => ({ ...prev, [provider]: 'failed' }));
      let errMsg = 'Connection failed';
      const msgLower = (e.message || "").toLowerCase();
      if (msgLower.includes("invalid json")) {
        errMsg = 'Invalid backend response';
      } else if (msgLower.includes("failed to fetch") || msgLower.includes("networkerror") || msgLower.includes("connection refused")) {
        errMsg = 'Backend unavailable';
      } else {
        errMsg = `Connection failed: ${e.message}`;
      }
      setStatusMessage({ type: 'error', text: errMsg });
    } finally {
      setIsSyncing(null);
    }
  };

  const handleConnect = async (provider: string) => {
    let credentials = '';
    let connType = '';

    if (provider === 'docker') {
      connType = 'Docker Endpoint';
      credentials = JSON.stringify({ endpoint: dockerEndpoint });
    } else if (provider === 'kubernetes') {
      connType = k8sMethod === 'paste' ? 'kubeconfig-paste' : 'kubeconfig-upload';
      credentials = JSON.stringify({ kubeconfig: k8sKubeconfig });
    } else if (provider === 'azure') {
      connType = azureMethod === 'cli' ? 'cli-login' : 'service-principal';
      credentials = JSON.stringify({
        tenantId: azureTenant,
        clientId: azureClient,
        clientSecret: azureSecret,
        subscriptionId: azureSub
      });
    } else if (provider === 'aws') {
      connType = awsMethod === 'cli' ? 'cli-login' : 'access-keys';
      credentials = JSON.stringify({
        accessKeyId: awsAccessKey,
        secretAccessKey: awsSecretKey,
        region: awsRegion
      });
    }

    setIsSyncing(provider);
    setProviderStatuses(prev => ({ ...prev, [provider]: 'testing' }));
    setStatusMessage({ type: 'info', text: `Connecting ${provider}...` });
    try {
      const res = await connectCloudConnection(provider, connType, credentials);
      if (res.success) {
        setProviderStatuses(prev => ({ ...prev, [provider]: 'connected' }));
        setStatusMessage({ type: 'success', text: `${provider} connected successfully! Dynamic sync initiated.` });
        loadConnections();
      } else {
        setProviderStatuses(prev => ({ ...prev, [provider]: 'failed' }));
        setStatusMessage({ type: 'error', text: `Failed to connect ${provider}: ${res.error || 'unknown error'}` });
      }
    } catch (e: any) {
      setProviderStatuses(prev => ({ ...prev, [provider]: 'failed' }));
      setStatusMessage({ type: 'error', text: `Connection error: ${e.message}` });
    } finally {
      setIsSyncing(null);
    }
  };

  const handleDisconnect = async (provider: string) => {
    if (!confirm(`Are you sure you want to disconnect ${provider} and wipe credentials?`)) return;
    
    setIsSyncing(provider);
    try {
      const res = await disconnectCloudConnection(provider);
      if (res.success) {
        setProviderStatuses(prev => ({ ...prev, [provider]: 'disconnected' }));
        setStatusMessage({ type: 'success', text: `${provider} disconnected successfully.` });
        
        // Reset form fields
        if (provider === 'docker') setDockerEndpoint('');
        else if (provider === 'kubernetes') setK8sKubeconfig('');
        else if (provider === 'azure') {
          setAzureTenant('');
          setAzureClient('');
          setAzureSecret('');
          setAzureSub('');
        } else if (provider === 'aws') {
          setAwsAccessKey('');
          setAwsSecretKey('');
          setAwsRegion('');
        }

        loadConnections();
      } else {
        setStatusMessage({ type: 'error', text: `Failed to disconnect: ${res.error || 'unknown error'}` });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: `Disconnection error: ${e.message}` });
    } finally {
      setIsSyncing(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setK8sKubeconfig(text);
        setStatusMessage({ type: 'success', text: `Loaded kubeconfig file: ${file.name}` });
      }
    };
    reader.readAsText(file);
  };

  const triggerSave = () => {
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Platform Settings</h1>
        <p className="text-sm text-brand-textSecondary">
          Configure autonomous auto-healing limits, integration endpoints, and credential security.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Tabs Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-soft space-y-1.5">
            {[
              { id: 'general', label: 'General Info', icon: Globe },
              { id: 'connections', label: 'Cloud Connections', icon: Cloud },
              { id: 'agents', label: 'Agents Autopilot', icon: Cpu },
              { id: 'keys', label: 'Integration Keys', icon: Key },
              { id: 'alerts', label: 'Alerting & Webhooks', icon: Bell },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors ${
                    activeTab === tab.id 
                      ? 'bg-brand-primary/5 text-brand-primary border border-brand-primary/10' 
                      : 'text-brand-textSecondary hover:text-brand-textPrimary border border-transparent'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Settings Content Pane */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-soft space-y-6">
            
            {/* Tab: General Info */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-brand-textPrimary text-sm">General Organization Profile</h3>
                  <p className="text-xs text-brand-textSecondary">Basic domain names and platform catalog parameters</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-brand-textSecondary uppercase">Organization Name</label>
                    <input 
                      type="text" 
                      defaultValue="AegisAI Labs Inc."
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:border-brand-primary rounded-xl text-brand-textPrimary" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-brand-textSecondary uppercase">Primary Domain Registry</label>
                    <input 
                      type="text" 
                      defaultValue="aegisai.x.internal"
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:border-brand-primary rounded-xl text-brand-textPrimary" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Cloud Connections */}
            {activeTab === 'connections' && (
              <div className="space-y-6">
                <div className="pb-3 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-brand-textPrimary text-sm">Cloud Connections & Integration Manager</h3>
                    <p className="text-xs text-brand-textSecondary">Manage secure credentials for Docker, Kubernetes, Azure, and AWS.</p>
                  </div>
                  <button 
                    onClick={loadConnections}
                    className="p-1.5 text-slate-500 hover:text-brand-primary hover:bg-slate-50 rounded-lg transition-all"
                    title="Reload Connection Statuses"
                  >
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  </button>
                </div>

                {statusMessage && (
                  <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                    statusMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-100' :
                    'bg-slate-50 text-slate-700 border-slate-100'
                  }`}>
                    <AlertCircle size={14} className={statusMessage.type === 'error' ? 'text-rose-500' : statusMessage.type === 'success' ? 'text-emerald-500' : 'text-slate-500'} />
                    <span className="flex-1">{statusMessage.text}</span>
                    <button onClick={() => setStatusMessage(null)} className="text-[10px] hover:underline uppercase font-bold text-slate-400">Dismiss</button>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Provider 1: Docker */}
                  {(() => {
                    const conn = connections.find(c => c.provider === 'docker');
                    const status = providerStatuses['docker'] || (conn?.status === 'connected' ? 'connected' : 'disconnected');
                    const isConnected = status === 'connected';
                    return (
                      <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                              <Server size={18} />
                            </div>
                            <div>
                              <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">Docker Integration</h4>
                              <span className="text-[10px] text-slate-400 font-semibold">Connection Type: Docker Endpoint</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(() => {
                              switch (status) {
                                case 'connected':
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">🟢 Connected</span>;
                                case 'testing':
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 flex items-center gap-1 animate-pulse">🟡 Testing</span>;
                                case 'failed':
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 flex items-center gap-1">🔴 Failed</span>;
                                default:
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-600 flex items-center gap-1 font-semibold">Disconnected</span>;
                              }
                            })()}
                            {conn?.lastSync && (
                              <span className="text-[9px] text-slate-400 font-medium">Sync: {new Date(conn.lastSync).toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>

                        {isConnected && conn?.metadata && (
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-white border border-slate-100 rounded-xl text-center">
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Version</span>
                              <span className="text-xs font-extrabold text-slate-700">{conn.metadata.version || 'unknown'}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Containers</span>
                              <span className="text-xs font-extrabold text-slate-700">{conn.metadata.containers ?? 0}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Images</span>
                              <span className="text-xs font-extrabold text-slate-700">{conn.metadata.images ?? 0}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Networks</span>
                              <span className="text-xs font-extrabold text-slate-700">{conn.metadata.networks ?? 0}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Volumes</span>
                              <span className="text-xs font-extrabold text-slate-700">{conn.metadata.volumes ?? 0}</span>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase">Docker Daemon Socket / Host Endpoint</label>
                            <input 
                              type="text"
                              value={dockerEndpoint}
                              onChange={(e) => setDockerEndpoint(e.target.value)}
                              placeholder="e.g. npipe:////./pipe/docker_engine or unix:///var/run/docker.sock"
                              className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl placeholder-slate-400 focus:outline-none focus:border-brand-primary" 
                            />
                          </div>

                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleTest('docker')}
                              disabled={isSyncing === 'docker'}
                              className="px-3 py-1.5 border border-slate-200 hover:border-brand-primary text-slate-600 hover:text-brand-primary rounded-lg text-xs font-bold transition-all"
                            >
                              Test Connection
                            </button>
                            {isConnected ? (
                              <button
                                onClick={() => handleDisconnect('docker')}
                                disabled={isSyncing === 'docker'}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                              >
                                <Power size={12} />
                                Disconnect
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConnect('docker')}
                                disabled={isSyncing === 'docker'}
                                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-lg text-xs font-bold transition-all"
                              >
                                Connect
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Provider 2: Kubernetes */}
                  {(() => {
                    const conn = connections.find(c => c.provider === 'kubernetes');
                    const status = providerStatuses['kubernetes'] || (conn?.status === 'connected' ? 'connected' : 'disconnected');
                    const isConnected = status === 'connected';
                    return (
                      <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                              <Database size={18} />
                            </div>
                            <div>
                              <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">Kubernetes Integration</h4>
                              <span className="text-[10px] text-slate-400 font-semibold">Connection Type: kubeconfig Configuration</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(() => {
                              switch (status) {
                                case 'connected':
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">🟢 Connected</span>;
                                case 'testing':
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 flex items-center gap-1 animate-pulse">🟡 Testing</span>;
                                case 'failed':
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 flex items-center gap-1">🔴 Failed</span>;
                                default:
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-600 flex items-center gap-1 font-semibold">Disconnected</span>;
                              }
                            })()}
                            {conn?.lastSync && (
                              <span className="text-[9px] text-slate-400 font-medium">Sync: {new Date(conn.lastSync).toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>

                        {isConnected && conn?.metadata && (
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-white border border-slate-100 rounded-xl text-center">
                            <div className="space-y-0.5 col-span-2 md:col-span-1">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Cluster</span>
                              <span className="text-xs font-extrabold text-slate-700 truncate block max-w-full" title={conn.metadata.clusterName}>{conn.metadata.clusterName || 'unknown'}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Context</span>
                              <span className="text-xs font-extrabold text-slate-700 truncate block max-w-full" title={conn.metadata.context}>{conn.metadata.context || 'default'}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Version</span>
                              <span className="text-xs font-extrabold text-slate-700">{conn.metadata.version || 'unknown'}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Nodes</span>
                              <span className="text-xs font-extrabold text-slate-700">{conn.metadata.nodes ?? 0}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Namespaces</span>
                              <span className="text-xs font-extrabold text-slate-700">{conn.metadata.namespaces ?? 0}</span>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="flex gap-4 border-b border-slate-100 pb-2">
                            <button
                              type="button"
                              onClick={() => setK8sMethod('paste')}
                              className={`text-xs font-bold pb-1 border-b-2 transition-all ${
                                k8sMethod === 'paste' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400'
                              }`}
                            >
                              Paste kubeconfig text
                            </button>
                            <button
                              type="button"
                              onClick={() => setK8sMethod('upload')}
                              className={`text-xs font-bold pb-1 border-b-2 transition-all ${
                                k8sMethod === 'upload' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400'
                              }`}
                            >
                              Upload kubeconfig file
                            </button>
                          </div>

                          {k8sMethod === 'paste' ? (
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">Kubeconfig YAML</label>
                              <textarea
                                value={k8sKubeconfig}
                                onChange={(e) => setK8sKubeconfig(e.target.value)}
                                placeholder="apiVersion: v1&#10;clusters:&#10;  - name: my-cluster..."
                                rows={4}
                                className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl placeholder-slate-400 font-mono focus:outline-none focus:border-brand-primary"
                              />
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">Kubeconfig file</label>
                              <div className="flex items-center justify-center w-full">
                                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer bg-white hover:bg-slate-50/50 hover:border-brand-primary transition-all">
                                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadCloud size={24} className="text-slate-400 mb-1" />
                                    <p className="text-xs font-semibold text-slate-500">Click to upload Kubeconfig file</p>
                                  </div>
                                  <input type="file" onChange={handleFileUpload} className="hidden" />
                                </label>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleTest('kubernetes')}
                              disabled={isSyncing === 'kubernetes'}
                              className="px-3 py-1.5 border border-slate-200 hover:border-brand-primary text-slate-600 hover:text-brand-primary rounded-lg text-xs font-bold transition-all"
                            >
                              Test Connection
                            </button>
                            {isConnected ? (
                              <button
                                onClick={() => handleDisconnect('kubernetes')}
                                disabled={isSyncing === 'kubernetes'}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                              >
                                <Power size={12} />
                                Disconnect
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConnect('kubernetes')}
                                disabled={isSyncing === 'kubernetes'}
                                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-lg text-xs font-bold transition-all"
                              >
                                Connect
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Provider 3: Azure */}
                  {(() => {
                    const conn = connections.find(c => c.provider === 'azure');
                    const status = providerStatuses['azure'] || (conn?.status === 'connected' ? 'connected' : 'disconnected');
                    const isConnected = status === 'connected';
                    return (
                      <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                              <Cloud size={18} />
                            </div>
                            <div>
                              <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">Azure Cloud Integration</h4>
                              <span className="text-[10px] text-slate-400 font-semibold">Connection Type: Azure CLI / Service Principal</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(() => {
                              switch (status) {
                                case 'connected':
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">🟢 Connected</span>;
                                case 'testing':
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 flex items-center gap-1 animate-pulse">🟡 Testing</span>;
                                case 'failed':
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 flex items-center gap-1">🔴 Failed</span>;
                                default:
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-600 flex items-center gap-1 font-semibold">Disconnected</span>;
                              }
                            })()}
                            {conn?.lastSync && (
                              <span className="text-[9px] text-slate-400 font-medium">Sync: {new Date(conn.lastSync).toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>

                        {isConnected && conn?.metadata && (
                          <div className="grid grid-cols-2 gap-3 p-3 bg-white border border-slate-100 rounded-xl text-center">
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Subscription</span>
                              <span className="text-xs font-extrabold text-slate-700 truncate block max-w-full" title={conn.metadata.subscriptionName}>{conn.metadata.subscriptionName || 'unknown'}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Subscription ID</span>
                              <span className="text-xs font-extrabold text-slate-700 truncate block max-w-full" title={conn.metadata.subscriptionId}>{conn.metadata.subscriptionId || 'unknown'}</span>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="flex gap-4 border-b border-slate-100 pb-2">
                            <button
                              type="button"
                              onClick={() => setAzureMethod('cli')}
                              className={`text-xs font-bold pb-1 border-b-2 transition-all ${
                                azureMethod === 'cli' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400'
                              }`}
                            >
                              Existing Azure CLI login
                            </button>
                            <button
                              type="button"
                              onClick={() => setAzureMethod('sp')}
                              className={`text-xs font-bold pb-1 border-b-2 transition-all ${
                                azureMethod === 'sp' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400'
                              }`}
                            >
                              Service Principal
                            </button>
                          </div>

                          {azureMethod === 'cli' ? (
                            <p className="text-[10px] text-slate-500 font-semibold">
                              AegisAI-X will read your existing authenticated local Azure CLI session. Make sure you have run <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[9px]">az login</code> on the host system.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Tenant ID</label>
                                <input
                                  type="text"
                                  value={azureTenant}
                                  onChange={(e) => setAzureTenant(e.target.value)}
                                  placeholder="e.g. e81e5b22-..."
                                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl placeholder-slate-400 focus:outline-none focus:border-brand-primary"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Client ID</label>
                                <input
                                  type="text"
                                  value={azureClient}
                                  onChange={(e) => setAzureClient(e.target.value)}
                                  placeholder="e.g. b2a6e9fc-..."
                                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl placeholder-slate-400 focus:outline-none focus:border-brand-primary"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Client Secret</label>
                                <input
                                  type="password"
                                  value={azureSecret}
                                  onChange={(e) => setAzureSecret(e.target.value)}
                                  placeholder="••••••••••••••••••••"
                                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl placeholder-slate-400 focus:outline-none focus:border-brand-primary"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Subscription ID</label>
                                <input
                                  type="text"
                                  value={azureSub}
                                  onChange={(e) => setAzureSub(e.target.value)}
                                  placeholder="e.g. d6f3e1a0-..."
                                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl placeholder-slate-400 focus:outline-none focus:border-brand-primary"
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleTest('azure')}
                              disabled={isSyncing === 'azure'}
                              className="px-3 py-1.5 border border-slate-200 hover:border-brand-primary text-slate-600 hover:text-brand-primary rounded-lg text-xs font-bold transition-all"
                            >
                              Test Connection
                            </button>
                            {isConnected ? (
                              <button
                                onClick={() => handleDisconnect('azure')}
                                disabled={isSyncing === 'azure'}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                              >
                                <Power size={12} />
                                Disconnect
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConnect('azure')}
                                disabled={isSyncing === 'azure'}
                                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-lg text-xs font-bold transition-all"
                              >
                                Connect
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Provider 4: AWS */}
                  {(() => {
                    const conn = connections.find(c => c.provider === 'aws');
                    const status = providerStatuses['aws'] || (conn?.status === 'connected' ? 'connected' : 'disconnected');
                    const isConnected = status === 'connected';
                    return (
                      <div className="p-4 border border-slate-100 rounded-2xl bg-slate-50/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                              <Cloud size={18} />
                            </div>
                            <div>
                              <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">AWS Cloud Integration</h4>
                              <span className="text-[10px] text-slate-400 font-semibold">Connection Type: AWS CLI / Access Keys</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {(() => {
                              switch (status) {
                                case 'connected':
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">🟢 Connected</span>;
                                case 'testing':
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 flex items-center gap-1 animate-pulse">🟡 Testing</span>;
                                case 'failed':
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 flex items-center gap-1">🔴 Failed</span>;
                                default:
                                  return <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-600 flex items-center gap-1 font-semibold">Disconnected</span>;
                              }
                            })()}
                            {conn?.lastSync && (
                              <span className="text-[9px] text-slate-400 font-medium">Sync: {new Date(conn.lastSync).toLocaleTimeString()}</span>
                            )}
                          </div>
                        </div>

                        {isConnected && conn?.metadata && (
                          <div className="grid grid-cols-2 gap-3 p-3 bg-white border border-slate-100 rounded-xl text-center">
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Account ID</span>
                              <span className="text-xs font-extrabold text-slate-700 truncate block max-w-full" title={conn.metadata.accountId}>{conn.metadata.accountId || 'unknown'}</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="block text-[9px] text-slate-400 font-bold uppercase">Region</span>
                              <span className="text-xs font-extrabold text-slate-700 truncate block max-w-full" title={conn.metadata.region}>{conn.metadata.region || 'us-east-1'}</span>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="flex gap-4 border-b border-slate-100 pb-2">
                            <button
                              type="button"
                              onClick={() => setAwsMethod('cli')}
                              className={`text-xs font-bold pb-1 border-b-2 transition-all ${
                                awsMethod === 'cli' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400'
                              }`}
                            >
                              Existing AWS CLI login
                            </button>
                            <button
                              type="button"
                              onClick={() => setAwsMethod('keys')}
                              className={`text-xs font-bold pb-1 border-b-2 transition-all ${
                                awsMethod === 'keys' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-slate-400'
                              }`}
                            >
                              Access Keys
                            </button>
                          </div>

                          {awsMethod === 'cli' ? (
                            <p className="text-[10px] text-slate-500 font-semibold">
                              AegisAI-X will read your existing authenticated local AWS CLI configuration. Make sure you have run <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[9px]">aws configure</code> on the host system.
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Access Key ID</label>
                                <input
                                  type="text"
                                  value={awsAccessKey}
                                  onChange={(e) => setAwsAccessKey(e.target.value)}
                                  placeholder="e.g. AKIA..."
                                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl placeholder-slate-400 focus:outline-none focus:border-brand-primary"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Secret Access Key</label>
                                <input
                                  type="password"
                                  value={awsSecretKey}
                                  onChange={(e) => setAwsSecretKey(e.target.value)}
                                  placeholder="••••••••••••••••••••"
                                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl placeholder-slate-400 focus:outline-none focus:border-brand-primary"
                                />
                              </div>
                              <div className="space-y-1 md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Default Region</label>
                                <input
                                  type="text"
                                  value={awsRegion}
                                  onChange={(e) => setAwsRegion(e.target.value)}
                                  placeholder="e.g. us-east-1"
                                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl placeholder-slate-400 focus:outline-none focus:border-brand-primary"
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleTest('aws')}
                              disabled={isSyncing === 'aws'}
                              className="px-3 py-1.5 border border-slate-200 hover:border-brand-primary text-slate-600 hover:text-brand-primary rounded-lg text-xs font-bold transition-all"
                            >
                              Test Connection
                            </button>
                            {isConnected ? (
                              <button
                                onClick={() => handleDisconnect('aws')}
                                disabled={isSyncing === 'aws'}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                              >
                                <Power size={12} />
                                Disconnect
                              </button>
                            ) : (
                              <button
                                onClick={() => handleConnect('aws')}
                                disabled={isSyncing === 'aws'}
                                className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-lg text-xs font-bold transition-all"
                              >
                                Connect
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Tab: Agents Autopilot */}
            {activeTab === 'agents' && (
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-brand-textPrimary text-sm">Autonomous Intelligence Configuration</h3>
                  <p className="text-xs text-brand-textSecondary">Set active boundary limits for self-healing rules</p>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Auto-Pilot Active Mitigation</div>
                      <p className="text-[10px] text-brand-textSecondary max-w-md">Allow agents to automatically deploy Kubernetes pod scaling and RDS parameter updates without engineer manual approval.</p>
                    </div>
                    <button
                      onClick={() => setAutopilot(!autopilot)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        autopilot ? 'bg-brand-primary' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        autopilot ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-brand-textSecondary uppercase">Maximum Daily Self-Heal Limit</label>
                      <input 
                        type="number" 
                        defaultValue={20}
                        className="w-full px-3 py-2 text-xs border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:border-brand-primary rounded-xl text-brand-textPrimary" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-brand-textSecondary uppercase">Scale-Out Cool-Down Period (Mins)</label>
                      <input 
                        type="number" 
                        defaultValue={15}
                        className="w-full px-3 py-2 text-xs border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:border-brand-primary rounded-xl text-brand-textPrimary" 
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Integration Keys */}
            {activeTab === 'keys' && (
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-brand-textPrimary text-sm">Security API Keys & Credential Vault</h3>
                  <p className="text-xs text-brand-textSecondary">Tokens for Kubernetes CLI triggers and cloud integrations</p>
                </div>

                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                    <span className="block text-[10px] font-bold text-brand-textSecondary uppercase">AegisAI-X Cloud Secret Key</span>
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        value="••••••••••••••••••••••••••••••••••••••••"
                        disabled
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-200 bg-slate-100 rounded-xl text-brand-textPrimary" 
                      />
                      <button className="px-3 py-1.5 border border-slate-200 hover:border-brand-primary text-slate-700 hover:text-brand-primary font-bold rounded-xl text-xs transition-colors">
                        Reveal Key
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
                    <span className="block text-[10px] font-bold text-brand-textSecondary uppercase">Vector Database Sync Endpoint</span>
                    <input 
                      type="text" 
                      defaultValue="https://vectordb.aegisai.us-east-1.pinecone.io"
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl text-brand-textPrimary" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Alerting & Webhooks */}
            {activeTab === 'alerts' && (
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-brand-textPrimary text-sm">Slack & Webhook Configurations</h3>
                  <p className="text-xs text-brand-textSecondary">Establish active messaging endpoints for auto-healing events</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800">Slack Notifications integration</div>
                      <p className="text-[10px] text-brand-textSecondary">Stream self-healing operations logs into `#alerts-infra-operations`.</p>
                    </div>
                    <button
                      onClick={() => setNotificationsSlack(!notificationsSlack)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        notificationsSlack ? 'bg-brand-primary' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        notificationsSlack ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-slate-50">
                    <label className="block text-[10px] font-bold text-brand-textSecondary uppercase">Outbound Webhook Trigger URL</label>
                    <input 
                      type="text" 
                      defaultValue="https://api.opsgenie.com/v2/alerts/aegisai"
                      className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-xl text-brand-textPrimary" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions Save Control */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-brand-textSecondary font-semibold flex items-center gap-1">
                <ShieldCheck size={12} className="text-brand-success" />
                <span>Authorized Settings Control</span>
              </span>
              <button
                onClick={triggerSave}
                className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl text-xs shadow-soft transition-colors flex items-center gap-1.5"
              >
                {isSaved ? (
                  <>
                    <Check size={12} />
                    <span>Saved successfully</span>
                  </>
                ) : (
                  <span>Save changes</span>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
