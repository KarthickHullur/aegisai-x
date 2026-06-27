import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Page Imports
import Dashboard from './pages/dashboard/Dashboard';
import Incidents from './pages/incidents/Incidents';
import AgentHub from './pages/agents/AgentHub';
import DependencyGraph from './pages/dependency-graph/DependencyGraph';
import InfrastructureMemory from './pages/memory/InfrastructureMemory';
import SecurityCenter from './pages/security/SecurityCenter';
import CostOptimization from './pages/cost/CostOptimization';
import CloudCopilot from './pages/copilot/CloudCopilot';
import Settings from './pages/settings/Settings';
import PrometheusDashboard from './pages/prometheus/PrometheusDashboard';
import AzureDashboard from './pages/azure/AzureDashboard';
import AwsDashboard from './pages/aws/AwsDashboard';

function App() {
  return (
    <Router>
      <div className="flex min-h-screen w-full bg-brand-background text-brand-textPrimary font-sans antialiased">
        {/* Sidebar Navigation */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          
          {/* Dashboard / Subpages container */}
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto max-w-[1600px] w-full mx-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/agents" element={<AgentHub />} />
              <Route path="/dependency-graph" element={<DependencyGraph />} />
              <Route path="/memory" element={<InfrastructureMemory />} />
              <Route path="/security" element={<SecurityCenter />} />
              <Route path="/cost" element={<CostOptimization />} />
              <Route path="/azure" element={<AzureDashboard />} />
              <Route path="/aws" element={<AwsDashboard />} />
              <Route path="/copilot" element={<CloudCopilot />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/prometheus" element={<PrometheusDashboard />} />
              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
