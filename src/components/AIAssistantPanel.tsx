import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, Bot, User, Sparkles, MessageSquare, 
  RotateCcw, ShieldCheck, Cpu, Terminal
} from 'lucide-react';
import { api } from '../lib/api.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
}

interface AIAssistantPanelProps {
  athleteId: string;
}

export default function AIAssistantPanel({ athleteId }: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: "Biological Intelligence Assistant Active. I can explain risk factors and biomarker trends for this athlete. What would you like to investigate?",
      suggestions: ["Why flagged?", "Recent changes?", "Show biomarkers"]
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (query: string) => {
    if (!query.trim()) return;
    
    const userMsg: Message = { role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post(`/athletes/${athleteId}/assistant/ask`, { query });
      const botMsg: Message = { 
        role: 'assistant', 
        content: res.data.answer,
        suggestions: res.data.suggestions 
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Local intelligence engine encountered an error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-4xl border border-slate-200 shadow-xl flex flex-col h-[600px] overflow-hidden group">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500 rounded-xl">
             <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-widest">Medical Assistant</h3>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-black text-slate-400 uppercase">Deterministic Engine v6.0</span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setMessages([messages[0]])}
          className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] space-y-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-start gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`p-2 rounded-xl mt-1 ${m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-indigo-600'}`}>
                    {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`p-4 rounded-2xl shadow-sm text-sm font-bold leading-relaxed ${
                    m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-800'
                  }`}>
                    {m.content}
                  </div>
                </div>
                
                {m.suggestions && (
                  <div className="flex flex-wrap gap-2 mt-3 ml-11">
                    {m.suggestions.map((s, si) => (
                      <button 
                        key={si}
                        onClick={() => handleSend(s)}
                        className="px-4 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:border-indigo-400 hover:bg-indigo-50 transition-all shadow-sm"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {loading && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="flex justify-start"
            >
               <div className="ml-11 p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-2">
                  <div className="flex gap-1">
                     <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                     <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                     <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Synthesizing Reasoning...</span>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input */}
      <div className="p-6 border-t border-slate-100 bg-white">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
          className="relative"
        >
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about risk factors, trends, or medical ingestion..."
            className="w-full pl-6 pr-14 py-4 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          <button 
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-2 top-2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-200"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="mt-4 flex items-center justify-between">
           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3" /> Offline Reasoning Enabled
           </div>
           <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
              Press Enter to Send
           </div>
        </div>
      </div>
    </div>
  );
}
