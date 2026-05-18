import { useEffect, useState } from 'react';
import { 
  Users, 
  Activity, 
  AlertTriangle, 
  ClipboardList, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Brain,
  Cpu,
  Fingerprint,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { api } from '../lib/api.js';

const mockChartData = [
  { name: 'Jan', risk: 45, tests: 20 },
  { name: 'Feb', risk: 52, tests: 25 },
  { name: 'Mar', risk: 48, tests: 18 },
  { name: 'Apr', risk: 61, tests: 32 },
  { name: 'May', risk: 55, tests: 28 },
  { name: 'Jun', risk: 67, tests: 40 },
];

const mockAIHealth = [
  { subject: 'Recall', A: 120, B: 110, fullMark: 150 },
  { subject: 'Precision', A: 98, B: 130, fullMark: 150 },
  { subject: 'F1 Score', A: 86, B: 130, fullMark: 150 },
  { subject: 'AUC-ROC', A: 99, B: 100, fullMark: 150 },
  { subject: 'Stability', A: 85, B: 90, fullMark: 150 },
  { subject: 'Latency', A: 65, B: 85, fullMark: 150 },
];

import ActivityStreamPanel from '../components/ActivityStreamPanel.js';
import LiveAlertFeed from '../components/LiveAlertFeed.js';
import ConnectedUsersPanel from '../components/ConnectedUsersPanel.js';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, RefreshCw, X, Plus } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [isSubmittingInspection, setIsSubmittingInspection] = useState(false);
  
  const [inspectionData, setInspectionData] = useState({
    athleteId: '',
    title: '',
    description: '',
    priority: 'MEDIUM'
  });
  
  const [athletes, setAthletes] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/stats');
      setStats(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    api.get('/athletes').then(res => setAthletes(res.data.athletes));
  }, []);

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingInspection(true);
    try {
      await api.post('/inspections', inspectionData);
      toast.success('New investigation initiated');
      setIsInspectionModalOpen(false);
      setInspectionData({ athleteId: '', title: '', description: '', priority: 'MEDIUM' });
    } catch (error) {
      console.error(error);
      toast.error('Failed to create inspection');
    } finally {
      setIsSubmittingInspection(false);
    }
  };

  const refreshRisk = async () => {
    try {
      setIsSyncing(true);
      await api.post('/athletes/recalculate-all', {});
      await fetchStats();
      toast.success('Global intelligence recalibration completed');
    } catch (error) {
      console.error(error);
      toast.error('Global sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const runAudit = async () => {
    try {
      setIsAuditing(true);
      await api.post('/audit', {});
      toast.info('System-wide audit performed successfully');
    } catch (error) {
       console.error(error);
       toast.error('Audit failed');
    } finally {
       setIsAuditing(false);
    }
  };

  const statCards = [
    { label: 'Total Athletes', value: stats?.totalAthletes || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', change: '+2.4%', up: true },
    { label: 'OCR Extraction', value: '98.4%', icon: ClipboardList, color: 'text-emerald-600', bg: 'bg-emerald-50', change: '+1.2%', up: true },
    { label: 'Active Alerts', value: stats?.activeAlerts || 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', change: '-12%', up: false },
    { label: 'Medical Intelligence', value: 'ACTIVE', icon: Brain, color: 'text-indigo-600', bg: 'bg-indigo-50', change: '+0.5%', up: true },
  ];

  return (
    <div className="space-y-6 pb-12">
      <AnimatePresence>
        {isInspectionModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setIsInspectionModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.95}} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden">
               <div className="p-8">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-indigo-600" /> New Intelligence Audit
                     </h3>
                     <button onClick={()=>setIsInspectionModalOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
                  </div>
                  <form onSubmit={handleCreateInspection} className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Target Athlete</label>
                        <select 
                          required
                          value={inspectionData.athleteId}
                          onChange={(e)=>setInspectionData({...inspectionData, athleteId: e.target.value})}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold"
                        >
                           <option value="">Select Athlete</option>
                           {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Primary Finding/Title</label>
                        <input 
                          required
                          type="text"
                          value={inspectionData.title}
                          onChange={(e)=>setInspectionData({...inspectionData, title: e.target.value})}
                          placeholder="e.g. Hemoglobin Threshold Breach"
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold"
                        />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Intensity Level</label>
                        <div className="flex gap-2">
                           {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => (
                             <button
                               key={p}
                               type="button"
                               onClick={()=>setInspectionData({...inspectionData, priority: p})}
                               className={`flex-1 py-2 text-[10px] font-black rounded-lg border-2 transition-all ${inspectionData.priority === p ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 text-slate-400'}`}
                             >
                                {p}
                             </button>
                           ))}
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Detailed Observation</label>
                        <textarea 
                          value={inspectionData.description}
                          onChange={(e)=>setInspectionData({...inspectionData, description: e.target.value})}
                          rows={3}
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold"
                        />
                     </div>
                     <button 
                       disabled={isSubmittingInspection}
                       className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2"
                     >
                        {isSubmittingInspection ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                        Open Official Investigation
                     </button>
                  </form>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <Fingerprint className="w-8 h-8 text-indigo-600" /> BIOLOGICAL INTELLIGENCE
          </h1>
          <p className="text-slate-500 text-sm italic font-medium">PHASE 7: REAL-TIME SURVEILLANCE & LIVE INTELLIGENCE SYSTEM ACTIVE.</p>
        </div>
        <div className="flex gap-2">
          <button 
            disabled={isSyncing}
            onClick={refreshRisk}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />}
            Global AI Sync
          </button>
          <button 
            onClick={()=>setIsInspectionModalOpen(true)}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
          >
            New Inspection
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
         {/* LEFT COLUMN: MAIN ANALYTICS */}
         <div className="xl:col-span-3 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map((stat, i) => (
                <motion.div 
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-2xl ${stat.bg} group-hover:scale-110 transition-transform`}>
                      <stat.icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-full ${stat.up ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {stat.change}
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                  <h3 className="text-3xl font-black text-slate-900 mt-1">{loading ? '...' : stat.value}</h3>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                     <TrendingUp className="w-5 h-5 text-blue-600" /> Longitudinal AI Projections
                  </h3>
                  <div className="text-[10px] font-bold text-slate-400 uppercase border border-slate-100 px-3 py-1 rounded-full">90 Day Outlook</div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={mockChartData}>
                      <defs>
                        <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', background: '#fff' }}
                        labelStyle={{ fontWeight: 'black', marginBottom: '8px' }}
                      />
                      <Area type="monotone" dataKey="risk" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorRisk)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 rounded-4xl p-8 text-white relative overflow-hidden group shadow-2xl shadow-indigo-200/20">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <Cpu className="w-32 h-32" />
                </div>
                <h3 className="text-xl font-black mb-8 flex items-center gap-2">
                  <Zap className="w-6 h-6 text-yellow-400" /> INTELLIGENCE PIPELINE
                </h3>
                <div className="space-y-6">
                  {[
                    { label: 'Real-Time Surveillance', status: 'ACTIVE', progress: 100 },
                    { label: 'Deterministic Reasoning', status: 'ACTIVE', progress: 100 },
                    { label: 'AI Assistance Engine', status: 'ACTIVE', progress: 100 },
                    { label: 'Operational Sync', status: 'RUNNING', progress: 100 },
                  ].map((step, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                        <span>{step.label}</span>
                        <span className={step.status === 'COMPLETED' ? 'text-emerald-400' : 'text-indigo-400'}>{step.status}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${step.progress}%` }}
                          className="h-full bg-indigo-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-10 pt-6 border-t border-slate-800 flex justify-between items-center">
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Live Gateway Linked</span>
                   </div>
                   <span className="text-xs font-black text-indigo-400">WSS-V7.0</span>
                </div>
              </div>
            </div>
         </div>

         {/* RIGHT COLUMN: LIVE INTELLIGENCE */}
         <div className="xl:col-span-1 space-y-6">
            <ConnectedUsersPanel />
            <LiveAlertFeed />
            <ActivityStreamPanel />
         </div>
      </div>
    </div>
  );
}

function RegionProgress({ label, value, color }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-sm font-bold text-slate-700">{label}</span>
        <span className={`text-sm font-black ${value > 50 ? 'text-rose-600' : 'text-slate-900'}`}>{value}%</span>
      </div>
      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}
