import { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Trash2, 
  Plus, 
  MessageSquare, 
  Sparkles, 
  Terminal, 
  Cpu, 
  AlertTriangle 
} from 'lucide-react';
import { 
  askCopilot, 
  getCopilotHistory, 
  deleteCopilotHistory, 
  ChatFragment, 
  ApiError 
} from '../../services/api';
import { formatFriendlyTimestamp } from '../../utils/dateFormatter';

interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: number;
}

const suggestedQuestions = [
  'What is AWS?',
  'Difference between EC2 and S3',
  'Explain Kubernetes architecture',
  'What is Terraform?',
  'Top AWS interview questions',
  'Explain Docker networking',
  'How does VPC work?',
  'What is an IAM role?'
];

export default function CloudCopilot() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch copilot history from backend database
  const fetchHistory = async (selectNewId?: string) => {
    try {
      setHistoryLoading(true);
      setError(null);
      const res = await getCopilotHistory();
      
      const mappedSessions: ChatSession[] = (res.data || []).map(item => ({
        id: String(item.id),
        title: item.question.length > 25 ? item.question.substring(0, 25) + '...' : item.question,
        messages: [
          {
            id: `u-${item.id}`,
            role: 'user',
            content: item.question,
            timestamp: new Date(item.created_at).getTime()
          },
          {
            id: `m-${item.id}`,
            role: 'model',
            content: item.response,
            timestamp: new Date(item.created_at).getTime()
          }
        ],
        timestamp: new Date(item.created_at).getTime()
      }));

      setSessions(mappedSessions);

      // Select session logic
      if (selectNewId) {
        setActiveSessionId(selectNewId);
      } else if (mappedSessions.length > 0) {
        // Only override activeSessionId if it is empty or not in the mapped list
        if (!activeSessionId || !mappedSessions.some(s => s.id === activeSessionId)) {
          setActiveSessionId(mappedSessions[0].id);
        }
      } else {
        // If history is empty, create a new temporary consultation session
        const defaultSession: ChatSession = {
          id: 'new-session',
          title: 'New Cloud Consultation',
          messages: [],
          timestamp: Date.now()
        };
        setSessions([defaultSession]);
        setActiveSessionId(defaultSession.id);
      }
    } catch (err: any) {
      console.error('Failed to load copilot history:', err);
      setError('Unable to load copilot history from backend.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Scroll to bottom of chat on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId, loading]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    setError(null);
    setInputValue('');

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    // If active session is the temporary "new-session", populate it locally first
    if (activeSessionId === 'new-session') {
      setSessions(prev => prev.map(s => {
        if (s.id === 'new-session') {
          return {
            ...s,
            title: textToSend.length > 25 ? textToSend.substring(0, 25) + '...' : textToSend,
            messages: [userMessage]
          };
        }
        return s;
      }));
    } else {
      // Append user message locally to current active session
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...s.messages, userMessage],
            timestamp: Date.now()
          };
        }
        return s;
      }));
    }

    setLoading(true);

    try {
      // Obtain history fragments for Gemini SDK
      // Note: Since history contains alternating user and model replies, we extract it.
      // If we are on new-session, history is empty.
      const historyFragments: ChatFragment[] = [];
      if (activeSessionId !== 'new-session' && activeSession) {
        activeSession.messages.forEach(m => {
          historyFragments.push({
            role: m.role,
            content: m.content
          });
        });
      }

      await askCopilot({
        message: textToSend,
        history: historyFragments
      });

      // Refetch history from backend so that the newly saved database record is loaded.
      // We pass a callback or check the new list to select the newly created session.
      const freshHistory = await getCopilotHistory();
      if (freshHistory.data && freshHistory.data.length > 0) {
        // The newest item is the one we just asked
        const newestItem = freshHistory.data[0];
        const mappedSessions: ChatSession[] = freshHistory.data.map(item => ({
          id: String(item.id),
          title: item.question.length > 25 ? item.question.substring(0, 25) + '...' : item.question,
          messages: [
            {
              id: `u-${item.id}`,
              role: 'user',
              content: item.question,
              timestamp: new Date(item.created_at).getTime()
            },
            {
              id: `m-${item.id}`,
              role: 'model',
              content: item.response,
              timestamp: new Date(item.created_at).getTime()
            }
          ],
          timestamp: new Date(item.created_at).getTime()
        }));

        setSessions(mappedSessions);
        setActiveSessionId(String(newestItem.id));
      }
    } catch (err: any) {
      console.error(err);
      if (err instanceof ApiError) {
        setError(`Error [${err.status}]: ${err.message}`);
      } else {
        setError(err.message || 'Unable to receive response from Copilot');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewChat = () => {
    // Check if new-session is already open
    if (sessions.some(s => s.id === 'new-session')) {
      setActiveSessionId('new-session');
      return;
    }

    const tempSession: ChatSession = {
      id: 'new-session',
      title: 'New Cloud Consultation',
      messages: [],
      timestamp: Date.now()
    };
    setSessions([tempSession, ...sessions.filter(s => s.id !== 'new-session')]);
    setActiveSessionId(tempSession.id);
    setError(null);
  };

  const handleClearActiveChat = async () => {
    if (activeSessionId === 'new-session') {
      // Just clear messages locally
      setSessions(prev => prev.map(s => {
        if (s.id === 'new-session') {
          return {
            ...s,
            title: 'New Cloud Consultation',
            messages: []
          };
        }
        return s;
      }));
      return;
    }

    try {
      await deleteCopilotHistory(Number(activeSessionId));
      await fetchHistory();
    } catch (err: any) {
      console.error('Failed to clear active session:', err);
      setError('Unable to delete session from database.');
    }
  };

  const handleDeleteSession = async (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (idToDelete === 'new-session') {
      setSessions(prev => prev.filter(s => s.id !== 'new-session'));
      if (sessions.length > 1) {
        const nextActive = sessions.find(s => s.id !== 'new-session');
        if (nextActive) setActiveSessionId(nextActive.id);
      } else {
        // recreate new-session
        handleCreateNewChat();
      }
      return;
    }

    try {
      await deleteCopilotHistory(Number(idToDelete));
      // If we are deleting the active session, clear active session choice
      if (activeSessionId === idToDelete) {
        const remaining = sessions.filter(s => s.id !== idToDelete);
        if (remaining.length > 0) {
          const nextActive = remaining.find(s => s.id !== 'new-session') || remaining[0];
          setActiveSessionId(nextActive.id);
        } else {
          setActiveSessionId('');
        }
      }
      await fetchHistory();
    } catch (err: any) {
      console.error('Failed to delete copilot session:', err);
      setError('Unable to delete session from database.');
    }
  };

  return (
    <div className="flex flex-col space-y-6 h-[calc(100vh-140px)]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          <Sparkles className="text-brand-primary animate-pulse" size={24} />
          <span>Cloud Copilot</span>
        </h1>
        <p className="text-sm text-brand-textSecondary">Your SRE, Kubernetes, cloud architectures, and DevOps companion.</p>
      </div>

      {/* Main Console Box Split */}
      <div className="flex-1 flex bg-white border border-slate-100 rounded-2xl shadow-soft overflow-hidden min-h-0">
        
        {/* Left Sidebar: Session History */}
        <aside className="w-64 border-r border-slate-100 flex flex-col justify-between bg-slate-50/50 flex-shrink-0">
          <div className="p-4 border-b border-slate-100">
            <button 
              onClick={handleCreateNewChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/95 text-white font-bold rounded-xl text-xs transition-colors shadow-soft"
            >
              <Plus size={14} />
              <span>New Consultation</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
            <span className="block text-[10px] font-bold text-brand-textSecondary uppercase px-3 mb-2 tracking-wider">Consultation History</span>
            {historyLoading && sessions.length === 0 ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              sessions.map(s => {
                const isActive = s.id === activeSessionId;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setActiveSessionId(s.id);
                      setError(null);
                    }}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                      isActive 
                        ? 'bg-white border border-slate-100 shadow-soft text-brand-primary font-bold' 
                        : 'text-brand-textSecondary hover:text-brand-textPrimary hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <div className="flex items-center gap-2.5">
                        <MessageSquare size={14} className={isActive ? 'text-brand-primary flex-shrink-0' : 'text-slate-400 flex-shrink-0'} />
                        <span className="text-xs truncate font-semibold">{s.title}</span>
                      </div>
                      {s.id !== 'new-session' && (
                        <span className="text-[10px] text-brand-textSecondary pl-6 mt-0.5 font-medium">
                          {formatFriendlyTimestamp(s.timestamp)}
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-brand-danger transition-all rounded"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-white">
            <button 
              onClick={handleClearActiveChat}
              disabled={!activeSession || activeSession.messages.length === 0}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs transition-all disabled:opacity-40"
            >
              <Trash2 size={13} />
              <span>Clear Current Session</span>
            </button>
          </div>
        </aside>

        {/* Main Conversation Pane */}
        <section className="flex-1 flex flex-col justify-between bg-white min-w-0">
          
          {/* Messages Log area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {(!activeSession || activeSession.messages.length === 0) && (
              <div className="max-w-2xl mx-auto text-center py-12 space-y-6">
                <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 flex items-center justify-center mx-auto text-brand-primary shadow-soft">
                  <Cpu size={24} className="animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-bold text-slate-800">Ask Cloud Copilot</h2>
                  <p className="text-xs text-brand-textSecondary max-w-md mx-auto leading-relaxed">
                    Consult on AWS/Azure, Kubernetes architectures, IaC Terraform, Docker containers, networking VPCs, IAM policies, and system diagnostics.
                  </p>
                </div>

                {/* Suggested Questions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl mx-auto pt-4">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="text-left px-4 py-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-100 hover:border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-all active:scale-[0.98] flex items-center gap-2"
                    >
                      <Sparkles size={12} className="text-brand-primary flex-shrink-0" />
                      <span className="truncate">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeSession?.messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div 
                  key={msg.id}
                  className={`flex gap-4 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  {/* Icon Avatar */}
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-soft ${
                    isUser 
                      ? 'bg-slate-100 text-slate-700' 
                      : 'bg-brand-primary/10 text-brand-primary'
                  }`}>
                    {isUser ? <Plus size={14} className="rotate-45" /> : <Terminal size={14} />}
                  </div>

                  {/* Message Bubble */}
                  <div className={`p-4 rounded-2xl shadow-soft leading-relaxed text-xs border ${
                    isUser 
                      ? 'bg-brand-primary/5 border-brand-primary/10 text-slate-800' 
                      : 'bg-slate-50 border-slate-100 text-slate-800'
                  }`}>
                    {/* Render message body with pre-formatting for code blocks */}
                    <div className="whitespace-pre-wrap font-sans">
                      {msg.content.includes('\n') ? (
                        msg.content.split('\n').map((line, lIdx) => {
                          if (line.startsWith('- `') || line.startsWith('`')) {
                            return (
                              <code key={lIdx} className="block font-mono bg-slate-200/60 text-brand-primary px-2.5 py-1.5 rounded-lg my-1.5 overflow-x-auto text-[11px]">
                                {line.replace(/`/g, '').replace(/^- /, '')}
                              </code>
                            );
                          }
                          return <p key={lIdx} className="mb-1">{line}</p>;
                        })
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-4 mr-auto max-w-2xl">
                <div className="w-8 h-8 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0 animate-pulse">
                  <Terminal size={14} />
                </div>
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex items-center gap-2">
                  <span className="w-2 h-2 bg-brand-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-brand-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-brand-primary rounded-full animate-bounce" />
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50/50 border border-brand-danger/20 rounded-xl max-w-xl mx-auto flex items-start gap-3 text-brand-danger">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div className="text-xs space-y-2">
                  <span className="font-bold">{error}</span>
                  <p className="text-[10px] text-brand-textSecondary leading-relaxed">
                    Make sure the AegisAI-X backend is running and that your GEMINI_API_KEY is configured inside your environment.
                  </p>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Form Input block */}
          <div className="p-4 border-t border-slate-100 bg-white">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputValue);
              }}
              className="flex items-center gap-2 max-w-3xl mx-auto w-full border border-slate-200 focus-within:border-brand-primary focus-within:ring-1 focus-within:ring-brand-primary rounded-xl bg-white p-1.5 transition-all duration-200"
            >
              <input
                type="text"
                placeholder="Ask Cloud Copilot anything..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={loading}
                className="flex-1 pl-3 py-2 bg-transparent text-xs placeholder-slate-400 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !inputValue.trim()}
                className="flex items-center justify-center p-2 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-lg transition-all active:scale-[0.98] disabled:opacity-30 disabled:scale-100 flex-shrink-0"
              >
                <Send size={14} />
              </button>
            </form>
          </div>

        </section>

      </div>
    </div>
  );
}
