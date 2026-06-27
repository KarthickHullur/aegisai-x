import { X, Mail, Briefcase, Shield } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal Card using the AegisAI-X dark theme style */}
      <div className="relative w-full max-w-sm glass-panel-dark text-white rounded-3xl overflow-hidden shadow-premium border border-slate-700/50 p-6 space-y-6 animate-in zoom-in-95 duration-150">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>

        {/* Profile Image & Identification Section */}
        <div className="flex flex-col items-center text-center space-y-3.5 pt-4">
          <div className="relative">
            <img 
              src="/profile.jpg" 
              alt="Karthick" 
              className="w-24 h-24 rounded-3xl object-cover ring-4 ring-brand-primary/30 shadow-premium"
            />
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-brand-success ring-4 ring-slate-900" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Karthick</h2>
            <p className="text-xs font-bold text-brand-primary mt-0.5">Enterprise Operations</p>
          </div>
        </div>

        {/* Detail Rows */}
        <div className="space-y-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/40">
          <div className="flex items-center gap-3 text-xs">
            <Briefcase size={14} className="text-brand-secondary" />
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Role</span>
              <span className="font-semibold text-slate-200">Cloud Engineer</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs border-t border-slate-900/50 pt-2.5">
            <Mail size={14} className="text-brand-accent" />
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Email Address</span>
              <span className="font-semibold text-slate-200">karthickhullur1010@gmail.com</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs border-t border-slate-900/50 pt-2.5">
            <Shield size={14} className="text-brand-success" />
            <div>
              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Access Scope</span>
              <span className="font-semibold text-slate-200">Administrator (Root)</span>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-[10px] font-bold text-brand-primary uppercase tracking-wider">
            AegisAI-X Active Operator
          </span>
        </div>
      </div>
    </div>
  );
}
