import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  Network, 
  Cpu, 
  Brain, 
  ShieldAlert, 
  DollarSign, 
  Settings,
  Terminal,
  MessageSquare,
  Activity,
  Cloud
} from 'lucide-react';
import ProfileModal from './ProfileModal';

const navigation = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Incidents', to: '/incidents', icon: AlertTriangle },
  { name: 'Dependency Graph', to: '/dependency-graph', icon: Network },
  { name: 'Agent Control Hub', to: '/agents', icon: Cpu },
  { name: 'Infrastructure Memory', to: '/memory', icon: Brain },
  { name: 'Security Center', to: '/security', icon: ShieldAlert },
  { name: 'Cost Optimization', to: '/cost', icon: DollarSign },
  { name: 'Azure Cloud', to: '/azure', icon: Cloud },
  { name: 'AWS Cloud', to: '/aws', icon: Cloud },
  { name: 'Cloud Copilot', to: '/copilot', icon: MessageSquare },
  { name: 'Prometheus Observability', to: '/prometheus', icon: Activity },
  { name: 'Settings', to: '/settings', icon: Settings },
];

export default function Sidebar() {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  return (
    <>
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-100 bg-white min-h-screen sticky top-0">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center border-b border-slate-100 gap-2.5">
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

      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
              ${isActive 
                ? 'bg-slate-50 text-brand-primary shadow-sm shadow-brand-primary/5' 
                : 'text-brand-textSecondary hover:text-brand-textPrimary hover:bg-slate-50/60'}
            `}
          >
            {({ isActive }) => {
              const Icon = item.icon;
              return (
                <>
                  <Icon 
                    size={18} 
                    className={`
                      transition-transform duration-200 group-hover:scale-105
                      ${isActive ? 'text-brand-primary' : 'text-brand-textSecondary group-hover:text-brand-textPrimary'}
                    `} 
                  />
                  <span>{item.name}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-primary" />
                  )}
                </>
              );
            }}
          </NavLink>
        ))}
      </nav>

      {/* User Profile Card */}
      <div 
        onClick={() => setIsProfileOpen(true)}
        className="mx-4 mb-2 p-3 flex items-center gap-3 rounded-2xl border border-slate-100 hover:border-slate-200 bg-slate-50/30 hover:bg-slate-50/80 cursor-pointer transition-all duration-200 select-none"
      >
        <div className="relative">
          <img 
            src="/profile.jpg" 
            alt="Karthick" 
            className="w-9 h-9 rounded-xl object-cover ring-2 ring-white shadow-soft"
          />
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-brand-success ring-2 ring-white" />
        </div>
        <div className="text-left overflow-hidden">
          <div className="text-xs font-bold text-slate-800 truncate">Karthick</div>
          <div className="text-[10px] text-slate-400 font-medium truncate">Cloud Engineer</div>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 m-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-brand-success animate-pulse" />
          <div className="text-xs font-semibold text-brand-textPrimary">
            System Operations Active
          </div>
        </div>
        <p className="text-[10px] text-brand-textSecondary mt-1">
          7 agents scanning infrastructure
        </p>
      </div>
    </aside>
    <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
}
