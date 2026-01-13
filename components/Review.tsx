import React, { useState, useEffect } from 'react';
import { Signal, Thread } from '../types';
import { suggestRefinement } from '../services/geminiService';
import { ArrowRight, Trash2, Clock, CheckCircle, GitMerge, Search } from 'lucide-react';

interface ReviewProps {
  signals: Signal[];
  threads: Thread[];
  onDiscard: (id: string) => void;
  onKeep: (id: string) => void;
  onPromote: (id: string, reason: string) => void;
  onMerge: (signalId: string, threadId: string) => void;
  onClose: () => void;
}

const Review: React.FC<ReviewProps> = ({ signals, threads, onDiscard, onKeep, onPromote, onMerge, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Modes
  const [promoteMode, setPromoteMode] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  
  // Inputs
  const [reason, setReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestedReason, setSuggestedReason] = useState("");

  const currentSignal = signals[currentIndex];

  useEffect(() => {
    if (!currentSignal) return;
    // Reset state for new card
    setPromoteMode(false);
    setMergeMode(false);
    setReason("");
    setSuggestedReason("");
    setSearchQuery("");
  }, [currentIndex, currentSignal]);

  if (!currentSignal) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in duration-300">
        <CheckCircle className="w-16 h-16 text-violet-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Review Complete</h2>
        <p className="text-slate-500 mb-6">You're all caught up for today.</p>
        <button 
          onClick={onClose}
          className="px-6 py-2 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-colors font-medium shadow-lg shadow-slate-200"
        >
          Return Home
        </button>
      </div>
    );
  }

  const handleNext = () => {
    if (currentIndex < signals.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(prev => prev + 1); 
    }
  };

  const handleDiscard = () => {
    onDiscard(currentSignal.id);
    handleNext();
  };

  const handleKeep = () => {
    onKeep(currentSignal.id);
    handleNext();
  };

  // Promote Logic
  const initPromote = async () => {
    setPromoteMode(true);
    setAiLoading(true);
    const suggestion = await suggestRefinement(currentSignal.content);
    setSuggestedReason(suggestion);
    setAiLoading(false);
  };

  const confirmPromote = () => {
    if (!reason && !suggestedReason) return;
    onPromote(currentSignal.id, reason || suggestedReason);
    handleNext();
  };

  // Merge Logic
  const handleMerge = (threadId: string) => {
    onMerge(currentSignal.id, threadId);
    handleNext();
  };

  const filteredThreads = threads.filter(t => 
    t.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto p-4 justify-center">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold tracking-widest text-slate-400">
                REVIEW {currentIndex + 1} <span className="text-slate-300">/ {signals.length}</span>
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-800 text-sm font-medium transition-colors">Close</button>
        </div>

      <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-[0_20px_50px_rgb(0,0,0,0.05)] relative overflow-hidden min-h-[400px] flex flex-col justify-between">
        
        {/* Card Content */}
        <div className="flex-1">
          <div className="text-xs text-violet-600 font-bold mb-4 tracking-wider uppercase bg-violet-50 inline-block px-2 py-1 rounded">Signal</div>
          <p className="text-xl md:text-3xl font-medium text-slate-800 leading-relaxed">
            {currentSignal.content}
          </p>
          <div className="mt-6 text-xs text-slate-400 font-medium">
            Captured {new Date(currentSignal.createdAt).toLocaleTimeString()}
          </div>
        </div>

        {/* PROMOTE OVERLAY */}
        {promoteMode && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 p-8 flex flex-col animate-in slide-in-from-bottom-10 duration-200">
             <label className="text-violet-600 font-bold mb-2 block text-lg">
               Why does this matter?
             </label>
             <textarea 
               autoFocus
               value={reason}
               onChange={(e) => setReason(e.target.value)}
               placeholder={aiLoading ? "AI Thinking..." : (suggestedReason || "Type your reason...")}
               className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50 transition-all flex-1 mb-4 resize-none text-lg"
             />
             {suggestedReason && (
               <div className="mb-4">
                 <button 
                   onClick={() => setReason(suggestedReason)} 
                   className="text-xs text-violet-600 hover:text-violet-800 text-left border border-violet-100 p-3 rounded-lg bg-violet-50 w-full transition-colors"
                 >
                   ✨ AI Suggestion: "{suggestedReason}"
                 </button>
               </div>
             )}
             
             <div className="flex gap-3 mt-auto">
               <button 
                 onClick={() => setPromoteMode(false)}
                 className="flex-1 py-3 text-slate-500 hover:text-slate-800 transition-colors font-medium"
               >
                 Cancel
               </button>
               <button 
                 onClick={confirmPromote}
                 className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-violet-200"
               >
                 Create Thread <ArrowRight size={16} />
               </button>
             </div>
          </div>
        )}

        {/* MERGE OVERLAY */}
        {mergeMode && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 p-8 flex flex-col animate-in slide-in-from-bottom-10 duration-200">
             <h3 className="text-fuchsia-600 font-bold mb-4 flex items-center gap-2 text-lg">
                 <GitMerge size={20} />
                 Merge into existing thread
             </h3>
             
             <div className="relative mb-4">
                 <Search className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                 <input 
                    type="text"
                    placeholder="Search threads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:border-fuchsia-400 focus:outline-none focus:ring-4 focus:ring-fuchsia-50"
                 />
             </div>

             <div className="flex-1 overflow-y-auto space-y-2 -mr-4 pr-4">
                 {filteredThreads.length === 0 ? (
                     <div className="text-slate-400 text-sm text-center py-10">No matching threads found.</div>
                 ) : (
                     filteredThreads.map(t => (
                         <button
                            key={t.id}
                            onClick={() => handleMerge(t.id)}
                            className="w-full text-left p-4 rounded-xl border border-slate-100 hover:border-fuchsia-300 hover:bg-fuchsia-50 transition-all group"
                         >
                             <div className="text-slate-800 text-sm font-semibold truncate group-hover:text-fuchsia-700">{t.content}</div>
                             <div className="text-slate-400 text-xs mt-1 truncate">{t.updates.length} updates • {new Date(t.updatedAt).toLocaleDateString()}</div>
                         </button>
                     ))
                 )}
             </div>
             
             <div className="mt-4 pt-4 border-t border-slate-100">
               <button 
                 onClick={() => setMergeMode(false)}
                 className="w-full py-3 text-slate-500 hover:text-slate-800 transition-colors font-medium"
               >
                 Cancel
               </button>
             </div>
          </div>
        )}

        {/* Action Bar */}
        {!promoteMode && !mergeMode && (
          <div className="grid grid-cols-4 gap-3 mt-8 pt-6 border-t border-slate-100">
            <button 
              onClick={handleDiscard}
              className="flex flex-col items-center justify-center p-3 text-slate-400 hover:text-red-500 transition-colors gap-1 hover:bg-red-50 rounded-xl group"
            >
              <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] uppercase font-bold mt-1">Discard</span>
            </button>
            
            <button 
              onClick={handleKeep}
              className="flex flex-col items-center justify-center p-3 text-slate-400 hover:text-amber-500 transition-colors gap-1 hover:bg-amber-50 rounded-xl group"
            >
              <Clock className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] uppercase font-bold mt-1">Later</span>
            </button>

            <button 
              onClick={() => setMergeMode(true)}
              className="flex flex-col items-center justify-center p-3 text-slate-400 hover:text-fuchsia-600 transition-colors gap-1 hover:bg-fuchsia-50 rounded-xl group"
            >
              <GitMerge className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] uppercase font-bold mt-1">Merge</span>
            </button>
            
            <button 
              onClick={initPromote}
              className="flex flex-col items-center justify-center p-3 text-white bg-slate-800 hover:bg-violet-600 transition-colors gap-1 rounded-xl group shadow-md"
            >
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              <span className="text-[10px] uppercase font-bold mt-1">Thread</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Review;