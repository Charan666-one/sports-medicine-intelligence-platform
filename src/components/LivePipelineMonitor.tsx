import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, CheckCircle, Circle, Loader2, AlertCircle } from 'lucide-react';
import { socketClient } from '../services/socket.client.js';

interface PipelineStatus {
  stage: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  icon: any;
}

const STAGES = [
  { key: 'INGESTION', label: 'Report Ingestion' },
  { key: 'OCR_PARSING', label: 'OCR & Biological Extraction' },
  { key: 'VALIDATION', label: 'Medical Validation' },
  { key: 'DATA_PERSISTENCE', label: 'Passport Synchronization' },
  { key: 'AI_SCAN', label: 'AI Intelligence Scan' }
];

export default function LivePipelineMonitor({ athleteId }: { athleteId: string }) {
  const [pipeline, setPipeline] = useState<Record<string, 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'>>({
    INGESTION: 'PENDING',
    OCR_PARSING: 'PENDING',
    VALIDATION: 'PENDING',
    DATA_PERSISTENCE: 'PENDING',
    AI_SCAN: 'PENDING'
  });
  const [active, setActive] = useState(false);

  useEffect(() => {
    socketClient.connect();
    const unsubscribe = socketClient.subscribe('pipeline:update', (data) => {
      if (data.athleteId === athleteId) {
        setActive(true);
        setPipeline(prev => ({
          ...prev,
          [data.stage]: data.status as any
        }));
        
        if (data.stage === 'INGESTION' && data.status === 'COMPLETED') {
           setTimeout(() => setActive(false), 5000);
        }
      }
    });
    return () => unsubscribe();
  }, [athleteId]);

  if (!active) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-6"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 animate-pulse" />
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-xl">
              <Cpu className="w-5 h-5 text-white animate-spin" style={{ animationDuration: '3s' }} />
            </div>
            <div>
              <h4 className="text-white font-black text-sm uppercase tracking-widest">Live Intelligence Pipeline</h4>
              <p className="text-[10px] font-bold text-slate-500 uppercase">Synchronizing Biological Passport...</p>
            </div>
          </div>
          <div className="px-3 py-1 bg-slate-800 rounded-full text-[10px] font-black text-indigo-400 uppercase tracking-widest">
            Phase 7 Active
          </div>
        </div>

        <div className="flex justify-between relative">
          <div className="absolute top-4 left-0 w-full h-[1px] bg-slate-800 z-0" />
          
          {STAGES.map((s, i) => {
            const status = pipeline[s.key];
            return (
              <div key={s.key} className="flex flex-col items-center gap-3 relative z-10 w-1/5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  status === 'COMPLETED' ? 'bg-emerald-500 text-white' :
                  status === 'PROCESSING' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50' :
                  status === 'FAILED' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-500'
                }`}>
                  {status === 'COMPLETED' ? <CheckCircle className="w-4 h-4" /> :
                   status === 'PROCESSING' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                   status === 'FAILED' ? <AlertCircle className="w-4 h-4" /> :
                   <Circle className="w-4 h-4" />}
                </div>
                <span className={`text-[8px] font-black uppercase text-center tracking-tighter leading-tight ${
                  status === 'PROCESSING' ? 'text-indigo-400' : 
                  status === 'COMPLETED' ? 'text-emerald-400' : 'text-slate-500'
                }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
