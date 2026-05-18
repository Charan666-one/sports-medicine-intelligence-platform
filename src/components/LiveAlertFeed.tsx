import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, ShieldAlert, Cpu, BellRing, X } from 'lucide-react';
import { socketClient } from '../services/socket.client.js';

interface LiveAlert {
  id: string;
  athleteId: string;
  athleteName: string;
  score: number;
  reason: string;
  timestamp: string;
}

export default function LiveAlertFeed() {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);

  useEffect(() => {
    socketClient.connect();
    
    const unsubscribe = socketClient.subscribe('anomaly:detected', (data: any) => {
      const newAlert: LiveAlert = {
        id: Math.random().toString(36).substr(2, 9),
        athleteId: data.athleteId,
        athleteName: data.athleteName,
        score: data.score,
        reason: data.reason,
        timestamp: new Date().toISOString()
      };
      setAlerts(prev => [newAlert, ...prev].slice(0, 10));
    });

    return () => unsubscribe();
  }, []);

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
          <BellRing className="w-3 h-3 text-indigo-500" /> High-Priority Intelligence Alerts
        </h3>
        {alerts.length > 0 && (
           <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
        )}
      </div>

      <AnimatePresence>
        {alerts.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-8 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center text-slate-300"
          >
            <ShieldAlert className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No critical alerts detected</p>
          </motion.div>
        ) : (
          alerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 100 }}
              className="bg-rose-600 p-5 rounded-3xl shadow-xl shadow-rose-200 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-12 h-12 text-white" />
              </div>
              
              <button 
                onClick={() => removeAlert(alert.id)}
                className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded-lg text-white/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <Cpu className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-[10px] font-black text-rose-100 uppercase tracking-widest">
                    AI Anomaly Detected
                  </span>
                </div>
                
                <h4 className="text-white font-black text-lg mb-1">{alert.athleteName}</h4>
                <div className="flex items-center gap-2 mb-3">
                   <div className="px-2 py-0.5 bg-white/20 rounded-full text-[9px] font-black text-white uppercase tracking-widest">
                      Score: {(alert.score * 100).toFixed(1)}%
                   </div>
                   <span className="text-rose-200 text-[10px] font-bold">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                   </span>
                </div>
                
                <p className="text-rose-50 text-[11px] font-medium leading-relaxed bg-black/10 p-3 rounded-xl border border-white/10">
                   {alert.reason}
                </p>
                
                <button className="mt-4 w-full py-2 bg-white text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-50 transition-all shadow-lg">
                   Launch Investigation
                </button>
              </div>
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}
