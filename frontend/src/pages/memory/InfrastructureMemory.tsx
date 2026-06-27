import { useState } from 'react';
import { 
  Brain, 
  Search, 
  Sparkles, 
  ArrowRight, 
  BookOpen, 
  History 
} from 'lucide-react';
import { searchMemory } from '../../services/api';

interface SearchResult {
  id: string;
  title: string;
  source: 'runbook' | 'incident' | 'config';
  summary: string;
  relevance: number;
}

const mockResults: SearchResult[] = [
  {
    id: 'res-1',
    title: 'Kubernetes Pod Out-Of-Memory (OOM) Runbook',
    source: 'runbook',
    summary: 'Details escalation paths and memory limits adjustments for memory-intensive Node applications. Recommends configuring memory requests to 1Gi and limits to 2Gi to handle payload spike loops.',
    relevance: 98,
  },
  {
    id: 'res-2',
    title: 'Inc-410: Auth-Service memory leak outage logs',
    source: 'incident',
    summary: 'Historical incident from Oct 12: microservice experienced a slow leak in garbage collection cycles. Temporary mitigation: automated worker thread cycling. Final fix: replaced local session caching with Redis.',
    relevance: 85,
  },
  {
    id: 'res-3',
    title: 'Production Helm Values manifest configuration',
    source: 'config',
    summary: 'Contains memory allocations and autoscaling limits for `auth-service-chart` deployments. Limits are set to target CPU: 80% and Memory: 75% for horizontal pod autoscalers.',
    relevance: 74,
  }
];

export default function InfrastructureMemory() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError(null);

    try {
      // 1. Fetch matching investigations from PostgreSQL memory search
      const dbRes = await searchMemory(searchQuery);
      const dbResults: SearchResult[] = (dbRes.data || []).map((item) => ({
        id: `db-${item.id}`,
        title: item.incident_title,
        source: 'incident',
        summary: `${item.summary} | Root Cause: ${item.root_cause} | Recommendations: ${item.recommendations.join(', ')}`,
        relevance: 95,
      }));

      // 2. Filter local mock results if they match
      const localMatches = mockResults.filter(r =>
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.summary.toLowerCase().includes(searchQuery.toLowerCase())
      );

      setResults([...dbResults, ...localMatches]);
    } catch (err: any) {
      console.error('Failed to query memory:', err);
      setError(err.message || 'Unable to connect to the memory database.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    performSearch(suggestion);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3 py-4">
        <div className="w-12 h-12 rounded-2xl bg-main-gradient flex items-center justify-center text-white mx-auto shadow-soft">
          <Brain size={24} className="stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Infrastructure Memory</h1>
        <p className="text-sm text-brand-textSecondary max-w-md mx-auto">
          Semantic vector search across historical logs, incident post-mortems, configurations, and operations runbooks.
        </p>
      </div>

      {/* Main Search Panel */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-soft space-y-6">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask AegisAI-X about previous incidents, deployments, failures, and infrastructure knowledge..."
            className="w-full pl-12 pr-28 py-3.5 rounded-2xl text-sm border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 text-brand-textPrimary shadow-soft transition-all"
          />
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-brand-textSecondary">
            <Search size={18} />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="absolute right-2 top-2 px-4 py-2 rounded-xl text-xs font-bold bg-brand-primary text-white hover:bg-brand-primary/95 shadow-soft transition-colors flex items-center gap-1.5"
          >
            <span>{isSearching ? 'Indexing...' : 'Query Memory'}</span>
            <ArrowRight size={12} />
          </button>
        </form>

        {error && (
          <div className="p-3.5 text-xs bg-red-50/50 text-brand-danger rounded-2xl border border-brand-danger/20 font-semibold">
            {error}
          </div>
        )}

        {/* Suggestion tags */}
        {results.length === 0 && !isSearching && (
          <div className="space-y-3">
            <span className="block text-[10px] font-bold text-brand-textSecondary uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={12} className="text-brand-secondary" />
              <span>Suggested Queries</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                'What caused the auth database connection spike last week?',
                'Show Kubernetes pod crash OOM resolution procedures',
                'Retrieve production autoscaling manifests for auth-service',
                'Analyze RDS database CPU limits config history'
              ].map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-3 py-2 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-left text-xs font-semibold text-brand-textPrimary transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results Display */}
        {(isSearching || results.length > 0) && (
          <div className="space-y-4 pt-4 border-t border-slate-50">
            <div className="flex justify-between items-center text-xs font-bold text-brand-textSecondary uppercase">
              <span>Memory Matches found</span>
              <span className="flex items-center gap-1"><History size={12} /> Vector space search</span>
            </div>

            {isSearching ? (
              <div className="py-8 space-y-4">
                <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-3/4" />
                <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-5/6" />
                <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-2/3" />
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((res) => (
                  <div key={res.id} className="p-4 border border-slate-100 rounded-2xl hover:border-brand-primary/20 hover:shadow-soft transition-all duration-300 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg flex items-center justify-center text-xs ${
                          res.source === 'runbook' ? 'bg-brand-success/10 text-brand-success' :
                          res.source === 'incident' ? 'bg-brand-danger/10 text-brand-danger' :
                          'bg-brand-primary/10 text-brand-primary'
                        }`}>
                          <BookOpen size={12} />
                        </span>
                        <h3 className="font-bold text-brand-textPrimary text-xs">{res.title}</h3>
                      </div>
                      <span className="text-[10px] text-brand-success bg-brand-success/10 font-bold px-1.5 py-0.5 rounded-md">
                        {res.relevance}% Match
                      </span>
                    </div>

                    <p className="text-xs text-brand-textSecondary leading-relaxed pl-7">
                      {res.summary}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
