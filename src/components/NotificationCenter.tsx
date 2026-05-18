import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Zap, Info, ShieldAlert, X } from 'lucide-react';
import { socketClient } from '../services/socket.client.js';

interface Notification {
  id: string;
  type: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  message: string;
  title: string;
}

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    socketClient.connect();

    const handleEvent = (event: string, title: string, type: any) => {
      return (data: any) => {
        const id = Math.random().toString(36).substr(2, 9);
        const msg = data.message || data.reason || `Analysis completed for ${data.athleteName}`;
        
        setNotifications(prev => [...prev, { id, title, message: msg, type }]);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== id));
        }, 8000);
      };
    };

    const unsubScan = socketClient.subscribe('ai:scan_completed', handleEvent('ai:scan_completed', 'AI Analysis Done', 'INFO'));
    const unsubAnomaly = socketClient.subscribe('anomaly:detected', handleEvent('anomaly:detected', 'CRITICAL ANOMALY', 'CRITICAL'));
    const unsubActivity = socketClient.subscribe('activity:stream', (data) => {
      if (data.severity === 'CRITICAL' || data.severity === 'HIGH') {
        handleEvent('', data.type.replace(/_/g, ' '), data.severity)(data);
      }
    });

    return () => {
      unsubScan();
      unsubAnomaly();
      unsubActivity();
    };
  }, []);

  const remove = (id: string) => setNotifications(prev => prev.filter(n => n.id !== id));

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none w-80">
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            className={`pointer-events-auto p-4 rounded-2xl shadow-2xl flex gap-4 items-start border backdrop-blur-md ${
              n.type === 'CRITICAL' 
                ? 'bg-rose-600/90 border-rose-500 text-white' 
                : n.type === 'WARNING' || n.type === 'HIGH'
                ? 'bg-amber-500/90 border-amber-400 text-white'
                : 'bg-indigo-600/90 border-indigo-500 text-white'
            }`}
          >
            <div className="p-2 bg-white/20 rounded-xl">
              {n.type === 'CRITICAL' ? <ShieldAlert className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">{n.title}</h4>
              <p className="text-sm font-bold leading-tight">{n.message}</p>
            </div>
            <button onClick={() => remove(n.id)} className="p-1 hover:bg-white/10 rounded-lg">
              <X className="w-4 h-4 opacity-50" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
