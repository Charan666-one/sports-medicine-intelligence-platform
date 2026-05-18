import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users, Globe } from 'lucide-react';
import { socketClient } from '../services/socket.client.js';

export default function ConnectedUsersPanel() {
  const [count, setCount] = useState(1);

  useEffect(() => {
    socketClient.connect();
    const unsubscribe = socketClient.subscribe('system:users', (data) => {
      setCount(data.count);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-500/20 rounded-xl relative">
          <Globe className="w-5 h-5 text-indigo-400" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse border border-slate-900" />
        </div>
        <div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Active Analysts</span>
          <div className="flex items-center gap-1.5">
            <span className="text-white font-black text-lg">{count}</span>
            <span className="text-[10px] font-bold text-slate-400">Connected</span>
          </div>
        </div>
      </div>
      
      <div className="flex -space-x-2">
        {[...Array(Math.min(count, 4))].map((_, i) => (
          <div key={i} className={`w-8 h-8 rounded-full border-2 border-slate-900 flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-indigo-600' : 'bg-slate-800'} text-white`}>
             {String.fromCharCode(65 + i)}
          </div>
        ))}
        {count > 4 && (
          <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-[8px] font-black text-white">
            +{count - 4}
          </div>
        )}
      </div>
    </div>
  );
}
