import { useState, useEffect } from 'react';
import { 
  Search, 
  Database, 
  Server, 
  Globe, 
  Cpu, 
  AlertTriangle,
  Layers,
  Folder,
  HardDrive,
  Cloud,
  Activity,
  Loader2
} from 'lucide-react';
import { getTopology, TopologyNode } from '../../services/api';

export default function DependencyGraph() {
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTopology()
      .then(res => {
        setNodes(res.nodes);
        if (res.nodes.length > 0) {
          const defaultNode = res.nodes.find(n => n.id === 'gateway') || res.nodes.find(n => n.id === 'auth-service') || res.nodes[0];
          setSelectedNode(defaultNode);
        }
      })
      .catch(err => {
        console.error('Error fetching topology:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filteredNodes = nodes.filter(n => 
    n.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNodeClick = (node: TopologyNode) => {
    setSelectedNode(node);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'Running':
      case 'Healthy':
      case 'Available':
      case 'Succeeded':
        return '#10B981';
      case 'warning':
      case 'Warning':
      case 'Stopped':
      case 'VM stopped':
        return '#F59E0B';
      case 'critical':
      case 'Critical':
      case 'Failed':
      case 'Unhealthy':
        return '#EF4444';
      default:
        return '#10B981';
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'gateway': return <Globe size={16} />;
      case 'service': return <Server size={16} />;
      case 'database': return <Database size={16} />;
      case 'cache': return <Cpu size={16} />;
      case 'cluster': return <Layers size={16} className="text-violet-500" />;
      case 'namespace': return <Folder size={16} className="text-indigo-500" />;
      case 'deployment': return <Server size={16} className="text-sky-500" />;
      case 'pod': return <Activity size={16} className="text-emerald-500" />;
      case 'azure': return <Cloud size={16} className="text-blue-500" />;
      case 'subscription': return <Layers size={16} className="text-teal-500" />;
      case 'resource-group': return <Folder size={16} className="text-violet-500" />;
      case 'vm': return <Server size={16} className="text-cyan-500" />;
      case 'storage': return <HardDrive size={16} className="text-emerald-500" />;
      case 'aks': return <Cpu size={16} className="text-indigo-500" />;
      case 'provider': return <Cpu size={16} className="text-teal-500" />;
      default: return <Server size={16} />;
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Infrastructure Dependency Graph</h1>
        <p className="text-sm text-brand-textSecondary">
          Interactive map of container linkages, microservices, databases, and network communication loops.
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-brand-primary mb-3" size={32} />
          <span className="text-sm text-brand-textSecondary font-semibold">Generating dependency topology...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
          {/* Left Side: Filter and search bar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-soft space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-brand-textSecondary" size={14} />
                <input
                  type="text"
                  placeholder="Search topology nodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:border-brand-primary rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-[9px] font-bold text-brand-textSecondary uppercase tracking-wider">Topology Nodes</span>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {filteredNodes.map(node => (
                    <button
                      key={node.id}
                      onClick={() => handleNodeClick(node)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                        selectedNode?.id === node.id 
                          ? 'bg-brand-primary/5 text-brand-primary border border-brand-primary/10' 
                          : 'text-brand-textPrimary hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getStatusColor(node.status) }} />
                        <span className="truncate">{node.label}</span>
                      </div>
                      <span className="text-[10px] text-brand-textSecondary capitalize shrink-0 ml-1">{node.type}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Node detail panel */}
            {selectedNode && (
              <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-soft space-y-4 animate-in fade-in duration-200">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-brand-textPrimary text-sm truncate" title={selectedNode.label}>{selectedNode.label}</h3>
                    <span className="text-[9px] font-semibold text-brand-textSecondary uppercase tracking-wider">{selectedNode.type} Node</span>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg capitalize border shrink-0 ${
                    selectedNode.status === 'healthy' || selectedNode.status === 'Running' || selectedNode.status === 'Succeeded' || selectedNode.status === 'Available' ? 'bg-brand-success/10 text-brand-success border-brand-success/20' :
                    selectedNode.status === 'warning' || selectedNode.status === 'Warning' || selectedNode.status === 'Stopped' || selectedNode.status === 'VM stopped' ? 'bg-brand-warning/10 text-brand-warning border-brand-warning/20' :
                    'bg-brand-danger/10 text-brand-danger border-brand-danger/20'
                  }`}>
                    {selectedNode.status}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-brand-textSecondary">
                  <div className="flex justify-between border-b border-slate-50 pb-1.5 gap-2">
                    <span className="shrink-0">Node ID</span>
                    <span className="font-mono text-brand-textPrimary font-semibold truncate max-w-[140px]" title={selectedNode.id}>
                      {selectedNode.id}
                    </span>
                  </div>
                  {selectedNode.id.startsWith('/') || selectedNode.id.startsWith('azure') ? (
                    <div className="flex justify-between border-b border-slate-50 pb-1.5">
                      <span>Cloud Provider</span>
                      <span className="font-mono text-brand-textPrimary font-semibold">Microsoft Azure</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between border-b border-slate-50 pb-1.5">
                        <span>Host IP</span>
                        <span className="font-mono text-brand-textPrimary font-semibold">10.244.3.42</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-50 pb-1.5">
                        <span>Active Connections</span>
                        <span className="font-mono text-brand-textPrimary font-semibold">
                          {selectedNode.connections ? selectedNode.connections.length : 0} nodes
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {selectedNode.status === 'critical' && (
                  <div className="p-3 bg-brand-danger/5 border border-brand-danger/10 rounded-xl flex gap-2">
                    <AlertTriangle size={16} className="text-brand-danger flex-shrink-0 mt-0.5 animate-bounce" />
                    <div className="text-[10px] text-brand-danger leading-relaxed">
                      <strong>Incident investigator alert:</strong> Critical health state detected. Run AI Investigation inside Incidents tab.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Side: Graph Visualization Canvas (SVG based) */}
          <div className="lg:col-span-3 bg-white border border-slate-100 rounded-3xl p-5 shadow-soft min-h-[500px] flex flex-col justify-between relative overflow-hidden group">
            {/* SVG canvas */}
            <div className="flex-1 w-full flex items-center justify-center min-h-[400px]">
              <svg 
                className="w-full h-full max-w-full max-h-[500px] overflow-visible select-none"
                viewBox="0 0 1500 600"
              >
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#CBD5E1" />
                  </marker>
                  <marker id="arrow-error" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#EF4444" />
                  </marker>
                </defs>

                {/* Connecting Lines */}
                {nodes.map(sourceNode => 
                  (sourceNode.connections || []).map(targetId => {
                    const targetNode = nodes.find(n => n.id === targetId);
                    if (!targetNode) return null;
                    
                    const isErrorLink = sourceNode.status === 'critical' || targetNode.status === 'critical' || sourceNode.status === 'Critical' || targetNode.status === 'Critical';
                    
                    return (
                      <g key={`${sourceNode.id}-${targetId}`}>
                        <line
                          x1={sourceNode.x}
                          y1={sourceNode.y}
                          x2={targetNode.x}
                          y2={targetNode.y}
                          stroke={isErrorLink ? '#EF4444' : '#E2E8F0'}
                          strokeWidth={isErrorLink ? 2 : 1.5}
                          strokeDasharray={isErrorLink ? "4 4" : "0"}
                          className={isErrorLink ? "animate-[dash_2s_linear_infinite]" : ""}
                          markerEnd={`url(#${isErrorLink ? 'arrow-error' : 'arrow'})`}
                        />
                        {/* Pulse circle animating data flow */}
                        {!isErrorLink && (
                          <circle r="3.5" fill="#5B5FFB">
                            <animateMotion
                              dur="3s"
                              repeatCount="indefinite"
                              path={`M ${sourceNode.x} ${sourceNode.y} L ${targetNode.x} ${targetNode.y}`}
                            />
                          </circle>
                        )}
                      </g>
                    );
                  })
                )}

                {/* Graph Nodes */}
                {nodes.map(node => {
                  const isSelected = selectedNode?.id === node.id;
                  const nodeColor = getStatusColor(node.status);
                  
                  return (
                    <g 
                      key={node.id} 
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => handleNodeClick(node)}
                      className="cursor-pointer"
                    >
                      {/* Ring highlight if selected */}
                      {isSelected && (
                        <circle r="22" fill="none" stroke="#5B5FFB" strokeWidth="2" strokeDasharray="3 3" className="animate-spin-slow" />
                      )}

                      {/* Glowing effect for errors */}
                      {(node.status === 'critical' || node.status === 'Critical') && (
                        <circle r="20" fill="#EF4444" opacity="0.2" className="animate-ping" />
                      )}

                      {/* Core node circle */}
                      <circle 
                        r="16" 
                        fill="white" 
                        stroke={nodeColor} 
                        strokeWidth={isSelected ? 3.5 : 2.5}
                        className="shadow-soft transition-all duration-300"
                      />

                      {/* SVG Icon centering */}
                      <g transform="translate(-8, -8)" className="text-brand-textSecondary pointer-events-none">
                        <foreignObject width="16" height="16">
                          <div className="flex items-center justify-center text-slate-500 w-full h-full">
                            {getNodeIcon(node.type)}
                          </div>
                        </foreignObject>
                      </g>

                      {/* Node Text Label */}
                      <text 
                        y="32" 
                        textAnchor="middle" 
                        fontSize="9.5" 
                        fontWeight="700" 
                        fill="#0F172A"
                        className="font-sans pointer-events-none"
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Graph footer */}
            <div className="flex justify-between items-center text-[10px] text-brand-textSecondary pt-3 border-t border-slate-50">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-success" /> Healthy / Connected</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-warning" /> Warning / Stopped</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-danger animate-pulse" /> Outage (Diagnostic)</span>
              </div>
              <span>Click on nodes to view metadata attributes & linkages</span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
