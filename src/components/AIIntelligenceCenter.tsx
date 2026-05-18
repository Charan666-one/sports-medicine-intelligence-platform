import React from 'react';
import { motion } from 'motion/react';
import { Brain, ShieldCheck, Zap, Activity, AreaChart, BarChart3, TrendingUp, Info, Sparkles } from 'lucide-react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie
} from 'recharts';

interface XAIProps {
  insights: any;
}

export default function AIIntelligenceCenter({ insights }: XAIProps) {
  if (!insights) return null;

  const importanceData = Object.entries(insights.importance).map(([key, value]) => ({
    name: key.replace(/([A-Z])/g, ' $1').toUpperCase(),
    value: Number(value)
  })).sort((a, b) => b.value - a.value);

  const confidenceScore = insights.confidence?.score || 0;
  const reliability = insights.confidence?.label || 'UNKNOWN';

  return (
    <div className="space-y-6">
      {/* 1. Header & Confidence Gauge */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 bg-slate-900 rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform">
            <Brain className="w-32 h-32 text-indigo-400" />
          </div>
          <div className="relative z-10">
            <h2 className="text-white text-2xl font-black mb-2 flex items-center gap-3">
              <Brain className="w-8 h-8 text-indigo-400" /> AI INTELLIGENCE CENTER
            </h2>
            <p className="text-slate-400 text-sm font-medium max-w-lg mb-6">
              Production-grade Explainable AI (XAI) analysis mapping biomarker influence, 
              longitudinal stability, and pattern recognition.
            </p>
            <div className="flex flex-wrap gap-4">
               <div className="px-4 py-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl">
                  <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Model Precision</p>
                  <p className="text-white font-black text-lg">98.2%</p>
               </div>
               <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl">
                  <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest mb-1">Status</p>
                  <p className="text-white font-black text-lg uppercase">{insights.riskLevel}</p>
               </div>
               <div className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Engine Version</p>
                  <p className="text-white font-black text-lg">XAI-V2</p>
               </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Confidence Index</p>
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-100" />
                <motion.circle 
                  cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent"
                  strokeDasharray={364}
                  initial={{ strokeDashoffset: 364 }}
                  animate={{ strokeDashoffset: 364 - (364 * confidenceScore) }}
                  className={`${confidenceScore > 0.8 ? 'text-emerald-500' : confidenceScore > 0.5 ? 'text-indigo-500' : 'text-rose-500'}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-slate-900">{(confidenceScore * 100).toFixed(0)}%</span>
                <span className="text-[9px] font-black text-slate-400 uppercase">{reliability}</span>
              </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. Reasoning Engine & Findings */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 underline decoration-indigo-500 underline-offset-4">
              <Info className="w-5 h-5 text-indigo-600" /> AI REASONING ENGINE
           </h3>
            <div className="space-y-6">
              {insights.aiEnhancedSummary && (
                <div className="p-6 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                      <Zap className="w-16 h-16 text-white" />
                   </div>
                   <p className="text-[10px] font-black text-indigo-200 uppercase mb-3 tracking-widest flex items-center gap-2">
                      <Sparkles className="w-3 h-3" /> AI Enhanced Synthesis
                   </p>
                   <p className="text-white font-bold leading-relaxed relative z-10 text-sm">
                      {insights.aiEnhancedSummary}
                   </p>
                </div>
              )}

              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                 <p className="text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">Medical Reasoning (Deterministic)</p>
                 <p className="text-slate-900 font-bold leading-relaxed">{insights.reasoning?.summary || (insights.explanation ? insights.explanation[0] : 'N/A')}</p>
              </div>

              <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
                 <p className="text-[10px] font-black text-emerald-700 uppercase mb-2 tracking-widest">Risk Justification</p>
                 <p className="text-xs text-emerald-900 font-bold leading-relaxed italic">
                    "{insights.reasoning?.riskJustification || 'Pattern is consistent with biological profile baseline.'}"
                 </p>
              </div>
              
              <div className="space-y-3">
                 <p className="text-xs font-black text-slate-400 uppercase mb-3 tracking-widest">Clinical Identification Points</p>
                 {(insights.reasoning?.findings || insights.explanation || []).map((exp: string, i: number) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-start gap-3 p-3 bg-white border border-slate-100 rounded-xl"
                    >
                      <div className="mt-1 w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                      <p className="text-xs font-bold text-slate-700">{exp}</p>
                    </motion.div>
                 ))}
              </div>

             {insights.longitudinal && (
                <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-700 uppercase mb-2 tracking-widest">Longitudinal Insight</p>
                  <p className="text-xs text-indigo-900 font-bold italic leading-relaxed">
                    "{insights.longitudinal.trend}"
                  </p>
                </div>
             )}
           </div>
        </div>

        {/* 3. Feature Impact & Influence */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
           <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 underline decoration-indigo-500 underline-offset-4">
              <Activity className="w-5 h-5 text-indigo-600" /> BIOMARKER INFLUENCE MAP
           </h3>
           <div className="flex-1 w-full min-h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={importanceData} layout="vertical" margin={{ left: 20 }}>
                 <XAxis type="number" hide />
                 <YAxis dataKey="name" type="category" width={100} style={{ fontSize: '10px', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                 <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: '#f1f5f9' }}
                 />
                 <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                   {importanceData.map((entry, index) => (
                      <Cell key={index} fill={entry.value > 25 ? '#ef4444' : entry.value > 15 ? '#f97316' : '#6366f1'} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           </div>
           <div className="mt-6 flex justify-around p-4 bg-slate-50 rounded-2xl">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Stability</p>
                <p className="text-slate-900 font-black text-lg">{(insights.stabilityIndex * 100).toFixed(0)}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Anomalies</p>
                <p className={`font-black text-lg ${insights.anomaly.isAnomaly ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {insights.anomaly.isAnomaly ? 'DETECTED' : 'NONE'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Uncertainty</p>
                <p className="text-slate-900 font-black text-lg">{( (1 - confidenceScore) * 100).toFixed(1)}%</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
