import { Shield, Sparkles, Terminal } from 'lucide-react';

export default function GradientHero() {
  return (
    <div className="relative rounded-3xl bg-main-gradient p-6 md:p-8 lg:p-10 shadow-premium overflow-hidden text-white mb-8">
      {/* Decorative vector overlays */}
      <div className="absolute inset-0 opacity-15">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="absolute top-1/2 right-10 -translate-y-1/2 w-[350px] h-[350px] bg-white/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hero content */}
      <div className="relative z-10 max-w-3xl space-y-4">
        {/* Floating tech label */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-wider text-pink-100">
          <Sparkles size={12} />
          <span>Active Operations Engine v2.0</span>
        </div>

        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight">
          AegisAI-X
        </h1>
        
        <h2 className="text-lg md:text-xl font-semibold text-pink-100">
          Autonomous Cloud Reasoning Agent
        </h2>
        
        <p className="text-sm md:text-base text-slate-100 max-w-2xl leading-relaxed font-medium">
          An AI-native cloud agent that investigates incidents, understands infrastructure behavior, learns from operational history, predicts failures, and orchestrates intelligent remediation across distributed systems.
        </p>

        {/* Action Widgets */}
        <div className="pt-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm">
            <Shield size={16} className="text-pink-200" />
            <div className="text-left">
              <div className="text-[10px] font-semibold text-slate-200 uppercase">Security State</div>
              <div className="text-xs font-bold">Postured: 98% Secured</div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 border border-white/10 backdrop-blur-sm">
            <Terminal size={16} className="text-indigo-200" />
            <div className="text-left">
              <div className="text-[10px] font-semibold text-slate-200 uppercase">Self-Heals</div>
              <div className="text-xs font-bold">14 Mitigated Today</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
