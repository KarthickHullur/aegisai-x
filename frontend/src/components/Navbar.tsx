import { useState, useEffect } from 'react';
import { Bell, RefreshCw, Menu, X, Terminal, LayoutDashboard, AlertTriangle, Network, Cpu, Brain, ShieldAlert, DollarSign, Settings } from 'lucide-react';
import { NavLink, Link } from 'react-router-dom';
import SearchBar from './SearchBar';
import ProfileModal from './ProfileModal';
import { BASE_URL, getSystemMode, updateSystemMode } from '../services/api';

const navigation = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Incidents', to: '/incidents', icon: AlertTriangle },
  { name: 'Dependency Graph', to: '/dependency-graph', icon: Network },
  { name: 'Agent Control Hub', to: '/agents', icon: Cpu },
  { name: 'Infrastructure Memory', to: '/memory', icon: Brain },
  { name: 'Security Center', to: '/security', icon: ShieldAlert },
  { name: 'Cost Optimization', to: '/cost', icon: DollarSign },
  { name: 'Settings', to: '/settings', icon: Settings },
];

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [systemMode, setSystemMode] = useState<'LIVE' | 'DEMO'>('DEMO');
  const [hasCredentials, setHasCredentials] = useState(false);

  const fetchMode = async () => {
    try {
      const res = await getSystemMode();
      setSystemMode(res.mode);
      setHasCredentials(res.hasCredentials);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleMode = async (mode: 'LIVE' | 'DEMO') => {
    if (mode === 'LIVE' && !hasCredentials) {
      alert("No credentials configured. Please connect a Docker, Kubernetes, Azure, or AWS environment in Settings first.");
      return;
    }
    try {
      const res = await updateSystemMode(mode);
      if (res.success && res.mode) {
        setSystemMode(res.mode);
      }
    } catch (e: any) {
      alert("Failed to update system mode: " + e.message);
    }
  };

  useEffect(() => {
    fetchMode();
    const interval = setInterval(fetchMode, 5000);
    return () => clearInterval(interval);
  }, [hasCredentials]);

  const [healthStatus, setHealthStatus] = useState<{
    status: 'checking' | 'connected' | 'error';
    reason?: string;
  }>({ status: 'checking' });

  useEffect(() => {
    const runHealthCheck = async () => {
      try {
        if (!BASE_URL || !BASE_URL.startsWith('http')) {
          setHealthStatus({ status: 'error', reason: 'Invalid API_BASE_URL format' });
          return;
        }

        const response = await fetch(`${BASE_URL}/health`);
        if (!response.ok) {
          setHealthStatus({
            status: 'error',
            reason: `Backend returned status ${response.status}: ${response.statusText}`
          });
          return;
        }

        const data = await response.json();
        if (data.status !== 'healthy') {
          setHealthStatus({
            status: 'error',
            reason: `Backend reports unhealthy state: ${data.status || 'unknown'}`
          });
          return;
        }

        setHealthStatus({ status: 'connected' });
      } catch (err: any) {
        setHealthStatus({
          status: 'error',
          reason: err.message || 'Unable to reach AegisAI-X backend'
        });
      }
    };

    runHealthCheck();
    const interval = setInterval(runHealthCheck, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 1500);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="h-16 px-4 md:px-6 lg:px-8 flex items-center justify-between gap-4">
          
          {/* Mobile Menu & Logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-brand-textSecondary hover:text-brand-textPrimary hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-main-gradient flex items-center justify-center text-white shadow-soft">
                <Terminal size={15} className="stroke-[2.5]" />
              </div>
              <span className="font-extrabold text-sm tracking-tight bg-main-gradient bg-clip-text text-transparent">
                AegisAI-X
              </span>
            </div>
          </div>

          {/* Search Area */}
          <div className="hidden md:block flex-1 max-w-md">
            <SearchBar placeholder="Quick navigation search..." />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Health Check Badge */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-300 ${
                healthStatus.status === 'connected'
                  ? 'bg-brand-success/10 text-brand-success border-brand-success/20'
                  : healthStatus.status === 'checking'
                  ? 'bg-slate-100 text-brand-textSecondary border-slate-200'
                  : 'bg-brand-danger/10 text-brand-danger border-brand-danger/20'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  healthStatus.status === 'connected'
                    ? 'bg-brand-success animate-pulse'
                    : healthStatus.status === 'checking'
                    ? 'bg-slate-400 animate-spin'
                    : 'bg-brand-danger'
                }`} />
                <span>
                  {healthStatus.status === 'connected'
                    ? 'Backend Connected'
                    : healthStatus.status === 'checking'
                    ? 'Verifying Backend...'
                    : 'Backend Unavailable'}
                </span>
              </span>
              {healthStatus.status === 'error' && (
                <span className="text-[10px] text-brand-danger font-medium hidden md:inline-block max-w-[200px] truncate" title={healthStatus.reason}>
                  ({healthStatus.reason})
                </span>
              )}
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => handleToggleMode('DEMO')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 ${
                  systemMode === 'DEMO'
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                DEMO
              </button>
              <button
                onClick={() => handleToggleMode('LIVE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all duration-200 flex items-center gap-1 ${
                  systemMode === 'LIVE'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
                title={!hasCredentials ? "No credentials configured" : ""}
              >
                {!hasCredentials && <span className="w-1 h-1 rounded-full bg-slate-400" />}
                LIVE
              </button>
            </div>

            {/* Sync Button */}
            <button
              onClick={handleSync}
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-semibold bg-white border border-slate-200 hover:border-brand-primary text-brand-textPrimary shadow-soft hover:shadow-brand-primary/5 transition-all duration-200"
            >
              <RefreshCw 
                size={14} 
                className={`text-brand-primary ${isSyncing ? 'animate-spin' : ''}`} 
              />
              <span className="hidden sm:inline">Sync Infrastructure</span>
              <span className="sm:hidden">Sync</span>
            </button>

            {/* Notifications Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-brand-textSecondary hover:text-brand-textPrimary hover:bg-slate-50 rounded-xl transition-colors"
              >
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-accent ring-2 ring-white" />
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-premium p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-50 mb-3">
                    <h3 className="font-semibold text-xs text-brand-textPrimary">Recent Activity</h3>
                    <button className="text-[10px] text-brand-primary hover:underline font-medium">Mark all read</button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-danger mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-brand-textPrimary font-medium">K8s deployment failure resolved</p>
                        <span className="text-[10px] text-brand-textSecondary">2 mins ago • Reliability Agent</span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-success mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-brand-textPrimary font-medium">Database scale opportunity found</p>
                        <span className="text-[10px] text-brand-textSecondary">15 mins ago • Cost Agent</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div 
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center gap-2 border-l border-slate-100 pl-3 cursor-pointer hover:opacity-90 transition-all select-none"
            >
              <div className="relative">
                <img 
                  src="/profile.jpg" 
                  alt="Karthick" 
                  className="w-8 h-8 rounded-xl object-cover ring-2 ring-slate-50 shadow-soft"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-brand-success ring-2 ring-white" />
              </div>
              <div className="hidden xl:block text-left">
                <div className="text-xs font-bold text-brand-textPrimary">Karthick</div>
                <div className="text-[10px] text-brand-textSecondary">Cloud Engineer</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Global Demo Mode Banner */}
      {systemMode === 'DEMO' && (
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-2 flex items-center justify-between text-xs font-semibold text-amber-800 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping flex-shrink-0" />
            <span>Demo Mode — No credentials configured. Using seeded infrastructure snapshot.</span>
          </div>
          <Link 
            to="/settings" 
            className="text-brand-primary underline hover:text-brand-primary/85 font-bold transition-colors"
          >
            Configure Connections
          </Link>
        </div>
      )}

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex">
          <div className="w-72 bg-white h-full flex flex-col p-6 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-6 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-main-gradient flex items-center justify-center text-white shadow-soft">
                  <Terminal size={18} className="stroke-[2.5]" />
                </div>
                <div>
                  <span className="font-extrabold text-base tracking-tight bg-main-gradient bg-clip-text text-transparent">
                    AegisAI-X
                  </span>
                  <span className="block text-[9px] font-semibold text-brand-textSecondary tracking-wider uppercase">
                    Platform v1.0
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-brand-textSecondary hover:text-brand-textPrimary hover:bg-slate-50 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 py-6 space-y-1.5 overflow-y-auto">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                      ${isActive 
                        ? 'bg-slate-50 text-brand-primary' 
                        : 'text-brand-textSecondary hover:text-brand-textPrimary hover:bg-slate-50/60'}
                    `}
                  >
                    <Icon size={18} />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-slate-100 text-center">
              <div className="text-[10px] text-brand-textSecondary font-semibold uppercase tracking-wider">
                AegisAI-X Enterprise Edition
              </div>
            </div>
          </div>
        </div>
      )}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
}
