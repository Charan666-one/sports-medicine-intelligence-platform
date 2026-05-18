import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Zap, AlertCircle, FileText, CheckCircle, ShieldAlert } from 'lucide-react';
import { socketClient } from '../services/socket.client.js';

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  timestamp: string;
}

export default function ActivityStreamPanel() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    socketClient.connect();
    
    const unsubscribe = socketClient.subscribe('activity:stream', (data: ActivityItem) => {
      setActivities(prev => [data, ...prev].slice(0, 50));
    });

    return () => unsubscribe();
  }, []);

  const getIcon = (type: string, severity: string) => {
    switch (type) {
      case 'ANOMALY': return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      case 'AI_SCAN': return <Zap className="w-4 h-4 text-indigo-500" />;
      case 'INGESTION_START': return <FileText className="w-4 h-4 text-amber-500" />;
      case 'REPORT_COMPLETED': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      default: return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'border-l-4 border-l-rose-500 bg-rose-50/50';
      case 'HIGH': return 'border-l-4 border-l-orange-500 bg-orange-50/50';
      case 'WARNING': return 'border-l-4 border-l-amber-500 bg-amber-50/50';
      default: return 'border-l-4 border-l-indigo-500 bg-white';
    }
  };

  return (
    <div className="bg-white rounded-4xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full h-[600px]">
      <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500 rounded-xl">
             <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-widest">Operational Intelligence Feed</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-400 uppercase">Live Surveillance Active</span>
            </div>
          </div>
        </div>
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-800 px-3 py-1 rounded-full">
           {activities.length} Events Logged
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
        <AnimatePresence initial={false}>
          {activities.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 opacity-50">
               <Activity className="w-12 h-12" />
               <p className="text-xs font-black uppercase tracking-widest">Waiting for live data events...</p>
            </div>
          ) : (
            activities.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-4 rounded-2xl shadow-sm transition-all hover:shadow-md ${getSeverityStyle(item.severity)}`}
              >
                <div className="flex gap-4">
                  <div className="mt-1">{getIcon(item.type, item.severity)}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                      {item.severity === 'CRITICAL' && (
                        <span className="text-[8px] font-black bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full uppercase">Critical</span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-800 leading-relaxed">
                      {item.message}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
