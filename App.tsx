import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Send, 
  Layers, 
  GitGraph, 
  RefreshCw, 
  Plus, 
  MessageSquare,
  Sparkles,
  ArrowUpRight,
  Hash,
  Trash2
} from 'lucide-react';
import { 
  Signal, 
  Thread, 
  SignalStatus, 
  GraphData, 
  GraphNode, 
  GraphLink 
} from './types';
import Review from './components/Review';
import Graph from './components/Graph';
import { findSemanticConnections } from './services/geminiService';

// --- Utility Functions ---

const generateId = () => Math.random().toString(36).substring(2, 9);

const parseLinks = (text: string): string[] => {
  const regex = /\[\[(.*?)\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    links.push(match[1]);
  }
  return links;
};

const parseTags = (text: string): string[] => {
    const regex = /#([\w-]+)/g; // Support hyphens
    const tags: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        tags.push(match[1]);
    }
    return tags;
};

// --- Main Component ---

const App: React.FC = () => {
  // --- State ---
  const [signals, setSignals] = useState<Signal[]>(() => {
    const saved = localStorage.getItem('thread_signals');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [threads, setThreads] = useState<Thread[]>(() => {
    const saved = localStorage.getItem('thread_threads');
    return saved ? JSON.parse(saved) : [];
  });

  const [input, setInput] = useState("");
  const [view, setView] = useState<'capture' | 'review' | 'thread-list' | 'thread-detail'>('capture');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [recallSuggestions, setRecallSuggestions] = useState<string[]>([]);
  const [isGraphExpanded, setIsGraphExpanded] = useState(false);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('thread_signals', JSON.stringify(signals));
  }, [signals]);

  useEffect(() => {
    localStorage.setItem('thread_threads', JSON.stringify(threads));
  }, [threads]);

  // --- Computed Data ---
  
  // Signals ready for review (Unreviewed OR Kept < 48h ago)
  const reviewQueue = useMemo(() => {
    const now = Date.now();
    return signals.filter(s => {
      if (s.status === SignalStatus.UNREVIEWED) return true;
      if (s.status === SignalStatus.KEPT) {
        // Check expiry (48h)
        return (now - s.createdAt) < (48 * 60 * 60 * 1000);
      }
      return false;
    });
  }, [signals]);

  // Generate Graph Data
  const graphData: GraphData = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, GraphNode>();
    const tagMap = new Map<string, string>(); // Tag Name -> Node ID

    // 1. Add Threads as primary nodes
    threads.forEach(t => {
      const node: GraphNode = { id: t.id, label: t.content, type: 'thread', val: 2 };
      nodes.push(node);
      nodeMap.set(t.id, node);
    });

    // 2. Add Active Signals as smaller nodes
    signals.filter(s => s.status !== SignalStatus.DISCARDED).forEach(s => {
      // Don't duplicate if it promoted to thread (visualize the thread instead)
      if (s.status === SignalStatus.THREAD && s.threadId) return;
      
      const node: GraphNode = { id: s.id, label: s.content, type: 'signal', val: 1 };
      nodes.push(node);
      nodeMap.set(s.id, node);
    });

    // Helper to get or create a Tag Node
    const getTagId = (tagName: string) => {
        const lowerTag = tagName.toLowerCase();
        if (tagMap.has(lowerTag)) return tagMap.get(lowerTag)!;
        
        const tagId = `tag-${lowerTag}`;
        nodes.push({ id: tagId, label: lowerTag, type: 'tag', val: 1.5 });
        tagMap.set(lowerTag, tagId);
        return tagId;
    }

    // 3. Process Links (Explicit, Implicit, and Tags)
    const processContent = (sourceId: string, content: string) => {
        if (!nodeMap.has(sourceId)) return;

        // a. Explicit [[wikilinks]]
        const wikiLinks = parseLinks(content);
        wikiLinks.forEach(targetLabel => {
            const targetNode = nodes.find(n => n.type !== 'tag' && n.label.toLowerCase().includes(targetLabel.toLowerCase()));
            if (targetNode && targetNode.id !== sourceId) {
                links.push({ source: sourceId, target: targetNode.id });
            }
        });

        // b. Tags #hashtag
        const tags = parseTags(content);
        const uniqueTags = new Set(tags); // Deduplicate tags within the same content
        uniqueTags.forEach(tagName => {
            const tagId = getTagId(tagName);
            links.push({ source: sourceId, target: tagId });
        });

        // c. Implicit Thread Mentions (if content contains a Thread title)
        threads.forEach(t => {
            if (t.id !== sourceId && content.toLowerCase().includes(t.content.toLowerCase()) && t.content.length > 3) {
                links.push({ source: sourceId, target: t.id });
            }
        });
    };

    // Process Signals
    signals.forEach(s => {
        if (s.status === SignalStatus.DISCARDED) return;
        const sourceId = s.threadId || s.id;
        processContent(sourceId, s.content);
    });

    // Process Threads (content + updates)
    threads.forEach(t => {
        // Main content is already covered if it was a signal, but check again for cross-thread linking
        processContent(t.id, t.content);
        t.updates.forEach(u => processContent(t.id, u.content));
    });

    return { nodes, links };
  }, [signals, threads]);

  // --- Handlers ---

  const handleCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newSignal: Signal = {
      id: generateId(),
      content: input,
      createdAt: Date.now(),
      status: SignalStatus.UNREVIEWED
    };

    setSignals(prev => [newSignal, ...prev]);
    setInput("");
    setRecallSuggestions([]); // clear
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    
    // Simple debounce for "Recall" check
    if (val.length > 10 && val.endsWith(' ')) {
        const found = await findSemanticConnections(val, threads, signals);
        setRecallSuggestions(found);
    } else if (val.length < 5) {
        setRecallSuggestions([]);
    }
  };

  const handleDiscardSignal = (id: string) => {
    setSignals(prev => prev.map(s => s.id === id ? { ...s, status: SignalStatus.DISCARDED } : s));
  };

  const handleKeepSignal = (id: string) => {
    setSignals(prev => prev.map(s => s.id === id ? { ...s, status: SignalStatus.KEPT, createdAt: Date.now() } : s));
  };

  const handlePromoteSignal = (id: string, reason: string) => {
    const signal = signals.find(s => s.id === id);
    if (!signal) return;

    const newThread: Thread = {
      id: generateId(),
      originalSignalId: id,
      content: signal.content,
      reason,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      updates: []
    };

    setThreads(prev => [newThread, ...prev]);
    setSignals(prev => prev.map(s => s.id === id ? { ...s, status: SignalStatus.THREAD, threadId: newThread.id } : s));
  };

  const handleMergeSignal = (signalId: string, threadId: string) => {
    const signal = signals.find(s => s.id === signalId);
    if (!signal) return;

    // Add signal content as an update to the existing thread
    setThreads(prev => prev.map(t => {
        if (t.id !== threadId) return t;
        return {
            ...t,
            updatedAt: Date.now(),
            updates: [...t.updates, { 
                id: generateId(), 
                content: signal.content, 
                createdAt: Date.now() 
            }]
        };
    }));

    // Update signal status
    setSignals(prev => prev.map(s => s.id === signalId ? { ...s, status: SignalStatus.THREAD, threadId: threadId } : s));
  };

  const handleThreadUpdate = (threadId: string, content: string) => {
      setThreads(prev => prev.map(t => {
          if (t.id !== threadId) return t;
          return {
              ...t,
              updatedAt: Date.now(),
              updates: [...t.updates, { id: generateId(), content, createdAt: Date.now() }]
          };
      }));
  };

  const handleDeleteThread = (id: string) => {
      if(window.confirm("Are you sure you want to delete this thread?")) {
          setThreads(prev => prev.filter(t => t.id !== id));
          setView('thread-list');
          setActiveThreadId(null);
      }
  };

  const handleNodeClick = (id: string) => {
      const thread = threads.find(t => t.id === id);
      if (thread) {
          setActiveThreadId(thread.id);
          setView('thread-detail');
      }
  };

  // --- Render Views ---

  // 1. Thread List View
  const renderThreadList = () => (
    <div className="max-w-3xl mx-auto p-4 animate-in fade-in">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">Threads</h2>
            <button onClick={() => setView('capture')} className="text-slate-500 hover:text-violet-600 transition-colors">Back</button>
        </div>
        <div className="grid gap-4">
            {threads.length === 0 && <div className="text-slate-400 text-center py-10">No threads yet. Capture signals and promote them!</div>}
            {threads.sort((a,b) => b.updatedAt - a.updatedAt).map(t => (
                <div 
                    key={t.id} 
                    onClick={() => { setActiveThreadId(t.id); setView('thread-detail'); }}
                    className="bg-white border border-slate-200 p-4 rounded-xl cursor-pointer hover:border-violet-300 hover:shadow-md transition-all shadow-sm"
                >
                    <div className="flex justify-between items-start">
                        <h3 className="text-slate-800 font-semibold truncate">{t.content}</h3>
                        <span className="text-xs text-slate-400">{new Date(t.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">Why: {t.reason}</p>
                    <div className="mt-3 flex gap-2">
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t.updates.length} updates</span>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  // 2. Thread Detail View
  const renderThreadDetail = () => {
    const thread = threads.find(t => t.id === activeThreadId);
    if (!thread) return <div>Thread not found</div>;

    return (
        <div className="max-w-3xl mx-auto p-4 h-full flex flex-col animate-in slide-in-from-right-10 duration-200">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setView('thread-list')} className="text-slate-500 hover:text-violet-600 transition-colors">&larr; Back</button>
                <h2 className="text-xl font-bold text-slate-800 truncate flex-1">{thread.content}</h2>
                <button 
                  onClick={() => handleDeleteThread(thread.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Delete Thread"
                >
                  <Trash2 size={18} />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-6 pb-20">
                {/* Original Context */}
                <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
                    <div className="text-xs text-violet-600 font-bold mb-2 uppercase tracking-wider">Origin</div>
                    <p className="text-slate-700 italic text-lg">"{thread.content}"</p>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="text-xs text-slate-400 mb-1">Reason for importance:</div>
                        <p className="text-sm text-slate-600">{thread.reason}</p>
                    </div>
                </div>

                {/* Timeline */}
                <div className="relative pl-6 border-l-2 border-slate-200 space-y-8 ml-2">
                    {thread.updates.map(u => (
                        <div key={u.id} className="relative group">
                            <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-slate-100 border-2 border-slate-300 group-hover:border-violet-400 transition-colors"></div>
                            <div className="text-xs text-slate-400 mb-1">{new Date(u.createdAt).toLocaleString()}</div>
                            <p className="text-slate-700">{u.content}</p>
                        </div>
                    ))}
                    
                    {/* Input for new update */}
                    <div className="relative">
                        <div className="absolute -left-[31px] top-3 w-4 h-4 rounded-full bg-violet-100 border-2 border-violet-500 animate-pulse"></div>
                        <form 
                            onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.target as HTMLFormElement;
                                const input = form.elements.namedItem('update') as HTMLInputElement;
                                if(input.value.trim()) {
                                    handleThreadUpdate(thread.id, input.value);
                                    input.value = '';
                                }
                            }}
                            className="flex gap-2"
                        >
                            <input 
                                name="update"
                                type="text" 
                                placeholder="Add an update to this thread..."
                                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-slate-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 focus:outline-none shadow-sm placeholder:text-slate-400"
                            />
                            <button type="submit" className="bg-slate-800 hover:bg-violet-600 text-white p-3 rounded-lg transition-colors"><Plus size={18}/></button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  // 3. Capture View (Home)
  const renderCapture = () => (
    <div className="flex flex-col h-full relative">
        {/* Header */}
        <div className="flex justify-between items-center p-6 absolute top-0 w-full z-10 bg-gradient-to-b from-slate-50 to-transparent">
            <h1 className="text-2xl font-bold tracking-tighter text-slate-800">Thread.</h1>
            <div className="flex gap-4">
                 <button 
                    onClick={() => setIsGraphExpanded(!isGraphExpanded)}
                    className={`flex items-center gap-2 text-sm transition-colors ${isGraphExpanded ? 'text-violet-600 font-medium' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    <GitGraph size={18} />
                    <span className="hidden sm:inline">Graph</span>
                </button>
                <button 
                    onClick={() => setView('thread-list')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors"
                >
                    <Layers size={18} />
                    <span className="hidden sm:inline">Threads</span>
                </button>
                <button 
                    onClick={() => setView('review')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm transition-colors relative"
                >
                    <RefreshCw size={18} />
                    <span className="hidden sm:inline">Review</span>
                    {reviewQueue.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-violet-500 rounded-full border-2 border-slate-50"></span>
                    )}
                </button>
            </div>
        </div>

        {/* Dynamic Layout: Split Graph / Capture */}
        <div className={`flex-1 flex flex-col transition-all duration-500 ${isGraphExpanded ? 'pt-20' : 'justify-center'}`}>
            
            {/* Graph Visualization Area */}
            <div className={`w-full transition-all duration-500 ease-in-out px-4 ${isGraphExpanded ? 'h-[60vh] opacity-100 mb-6' : 'h-0 opacity-0 overflow-hidden'}`}>
                <Graph data={graphData} onNodeClick={handleNodeClick} />
            </div>

            {/* Input Area */}
            <div className="max-w-2xl w-full mx-auto px-6 z-20">
                 {/* Recall Hints */}
                 {recallSuggestions.length > 0 && (
                    <div className="mb-4 animate-in slide-in-from-bottom-5">
                        <div className="flex items-center gap-2 text-xs text-fuchsia-600 mb-2 font-medium">
                            <Sparkles size={12} />
                            <span>Related ideas found</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {recallSuggestions.map((s, i) => (
                                <div key={i} className="bg-white border border-fuchsia-200 text-slate-600 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                                    {s}
                                </div>
                            ))}
                        </div>
                    </div>
                 )}

                <form onSubmit={handleCapture} className="relative group">
                    <input
                        type="text"
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Capture a signal..."
                        autoFocus
                        className="w-full bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-lg md:text-xl rounded-2xl py-6 px-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] focus:outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50 transition-all"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-30 group-focus-within:opacity-100 transition-opacity">
                         <span className="text-xs text-slate-400 font-mono hidden sm:block">ENTER</span>
                         <button type="submit" className="bg-slate-800 p-2 rounded-xl text-white hover:bg-violet-600 transition-colors shadow-md">
                            <Send size={18} />
                         </button>
                    </div>
                </form>

                 <div className="mt-6 flex items-center justify-center gap-6 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5">
                        <Hash size={12} className="text-fuchsia-400" />
                        <span>Hashtags link ideas</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="font-mono text-violet-400">[[ ]]</span>
                        <span>Wikilinks supported</span>
                    </div>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-slate-400 text-sm">
                        {reviewQueue.length} signals waiting for <button onClick={() => setView('review')} className="text-violet-600 font-medium underline hover:text-violet-800 decoration-violet-200 underline-offset-2">Review</button>
                    </p>
                </div>
            </div>
        </div>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 overflow-hidden font-sans selection:bg-violet-100 selection:text-violet-900">
      {view === 'capture' && renderCapture()}
      
      {view === 'review' && (
        <Review 
            signals={reviewQueue} 
            threads={threads}
            onDiscard={handleDiscardSignal}
            onKeep={handleKeepSignal}
            onPromote={handlePromoteSignal}
            onMerge={handleMergeSignal}
            onClose={() => setView('capture')}
        />
      )}

      {view === 'thread-list' && renderThreadList()}
      {view === 'thread-detail' && renderThreadDetail()}
    </div>
  );
};

export default App;