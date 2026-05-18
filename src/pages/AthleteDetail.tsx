import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Activity, Shield, ClipboardList, Calendar, MapPin, Heart, ShieldAlert, BarChart3, TrendingUp, Zap, Brain, Fingerprint, Gauge, FileText, ShieldCheck, Database, Loader2, Plus, X } from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api.js';
import { socketClient } from '../services/socket.client.js';
import AIIntelligenceCenter from '../components/AIIntelligenceCenter.js';
import MedicalReportIntelligence from '../components/MedicalReportIntelligence.js';
import AIAssistantPanel from '../components/AIAssistantPanel.js';
import LivePipelineMonitor from '../components/LivePipelineMonitor.js';

export default function AthleteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [athlete, setAthlete] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'AI_CENTER' | 'REPORTS' | 'INGESTION'>('OVERVIEW');
  const [isInspectionModalOpen, setIsInspectionModalOpen] = useState(false);
  const [isSubmittingInspection, setIsSubmittingInspection] = useState(false);
  const [inspectionData, setInspectionData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM'
  });

  const fetchData = async () => {
    try {
      const [athleteRes, statsRes] = await Promise.all([
        api.get(`/athletes/${id}`),
        api.get(`/athletes/${id}/statistics`)
      ]);
      setAthlete(athleteRes.data.athlete);
      setStats(statsRes.data.stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Phase 7: Real-time synchronization
    socketClient.connect();
    if (id) {
      socketClient.joinAthlete(id);
      
      const unsubscribe = socketClient.subscribe('ai:scan_completed', (data: any) => {
        if (data.athleteId === id) {
          fetchData(); // Refresh data when AI scan completes
        }
      });
      
      return () => unsubscribe();
    }
  }, [id]);

  const runAIAnalysis = async () => {
    setAnalyzing(true);
    try {
      await api.post(`/athletes/${id}/ai-analysis`, {});
      await fetchData();
      toast.success('Deep Biological Scan Completed');
      setActiveTab('AI_CENTER');
    } catch (err) {
      console.error(err);
      toast.error('AI Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingInspection(true);
    try {
      await api.post('/inspections', { ...inspectionData, athleteId: id });
      toast.success('Intelligence audit opened for this athlete');
      setIsInspectionModalOpen(false);
      setInspectionData({ title: '', description: '', priority: 'MEDIUM' });
    } catch (error) {
      console.error(error);
      toast.error('Failed to initiate audit');
    } finally {
      setIsSubmittingInspection(false);
    }
  };

  if (loading) return <div className="p-20 text-center font-bold text-slate-400 font-mono tracking-tighter">INITIALIZING BIOLOGICAL PASSPORT ACCESS...</div>;
  if (!athlete) return <div className="p-20 text-center font-bold text-red-500">ATHLETE NOT FOUND</div>;

  const chartData = stats?.biomarkerTrends?.map((point: any) => {
    const results: any = { date: point.createdAt.split('T')[0] };
    point.testResults.forEach((r: any) => {
      results[r.parameter] = r.value;
    });
    return results;
  }) || [];

  return (
    <div className="space-y-6 pb-20">
      <LivePipelineMonitor athleteId={id || ''} />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/athletes')}
            className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm group"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight italic flex items-center gap-2">
              {athlete.name.toUpperCase()} <span className="text-blue-600">/</span> {athlete.sport.toUpperCase()}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${athlete.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                {athlete.status}
              </span>
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest">
                <Shield className="w-3 h-3" /> Secure Medical ID: {athlete.id.slice(0, 8)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setIsInspectionModalOpen(true)}
            className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-800 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
             <ShieldCheck className="w-4 h-4 text-emerald-500" /> New Inspection
          </button>
          <button 
            onClick={runAIAnalysis}
            disabled={analyzing}
            className={`flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-100 ${analyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {analyzing ? <Activity className="w-4 h-4 animate-spin text-blue-400" /> : <Brain className="w-4 h-4 text-blue-400" />}
            {analyzing ? 'Calibrating XAI-V2...' : 'RE-CALIBRATE AI INTELLIGENCE'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isInspectionModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setIsInspectionModalOpen(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.95}} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden">
               <div className="p-8">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-indigo-600" /> Initiate Audit: {athlete.name}
                     </h3>
                     <button onClick={()=>setIsInspectionModalOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
                  </div>
                  <form onSubmit={handleCreateInspection} className="space-y-4">
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

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit overflow-x-auto max-w-full">
        {[
          { id: 'OVERVIEW', label: 'Clinical Overview', icon: Activity },
          { id: 'AI_CENTER', label: 'Intelligence Center', icon: Brain },
          { id: 'INGESTION', label: 'Report Ingestion', icon: Database },
          { id: 'REPORTS', label: 'Medical History', icon: FileText }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-indigo-600' : ''}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'AI_CENTER' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2">
              <AIIntelligenceCenter insights={athlete.aiInsights} />
           </div>
           <div className="lg:col-span-1">
              <AIAssistantPanel athleteId={athlete.id} />
           </div>
        </div>
      ) : activeTab === 'INGESTION' ? (
        <MedicalReportIntelligence athleteId={athlete.id} />
      ) : activeTab === 'OVERVIEW' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center relative overflow-hidden">
               <div className="w-32 h-32 rounded-[2.5rem] bg-slate-50 mx-auto flex items-center justify-center text-5xl font-black text-slate-800 mb-6 border-4 border-white shadow-xl">
                  {athlete.name[0]}
               </div>
               <h3 className="text-xl font-black text-slate-900">{athlete.name}</h3>
               <p className="text-blue-600 font-bold uppercase tracking-widest text-[10px] mt-1">{athlete.nationality} / {athlete.gender}</p>
               
               <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Age</p>
                    <p className="text-slate-900 font-black text-lg">{Math.floor((new Date().getTime() - new Date(athlete.dateOfBirth).getTime()) / 31557600000)}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Risk Score</p>
                    <p className={`font-black text-lg ${athlete.riskScore > 75 ? 'text-rose-600' : 'text-slate-900'}`}>{athlete.riskScore.toFixed(0)}</p>
                  </div>
               </div>
               
               {athlete.aiInsights?.explanation?.length > 0 && (
                  <div className="mt-6 p-5 bg-indigo-50 rounded-2xl border border-indigo-100 text-left">
                    <p className="text-[10px] font-black text-indigo-700 uppercase mb-2 flex items-center gap-1">
                      <Fingerprint className="w-3 h-3" /> Latest AI Insight
                    </p>
                    <p className="text-[11px] font-bold text-indigo-900 leading-tight italic">
                      "{athlete.aiInsights.explanation[0]}"
                    </p>
                  </div>
               )}

               {athlete.riskFindings?.length > 0 && (
                  <div className="mt-4 p-5 bg-rose-50 rounded-2xl border border-rose-100 text-left">
                    <p className="text-[10px] font-black text-rose-700 uppercase mb-3 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Clinical Findings
                    </p>
                    <ul className="space-y-2">
                      {athlete.riskFindings.map((finding: string, i: number) => (
                        <li key={i} className="text-[11px] font-bold text-rose-900 flex items-start gap-2">
                          <div className="mt-1 w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                          {finding}
                        </li>
                      ))}
                    </ul>
                  </div>
               )}
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
               <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 underline decoration-blue-500 underline-offset-8">
                  <BarChart3 className="w-5 h-5 text-blue-600" /> Z-SCORE INDICATORS
               </h3>
               <div className="space-y-6">
                 {athlete.reports[0]?.testResults.map((test: any, i: number) => (
                   <div key={test.id}>
                     <div className="flex justify-between items-center mb-2">
                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{test.parameter}</span>
                       <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${Math.abs(test.deviation || 0) > 2 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'}`}>
                         {test.deviation ? `${test.deviation > 0 ? '+' : ''}${test.deviation.toFixed(2)}σ` : '0.00σ'}
                       </span>
                     </div>
                     <div className="h-2 w-full bg-slate-100 rounded-full relative">
                        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-300 z-10" />
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ 
                            width: `${Math.min(Math.abs((test.deviation || 0) / 4) * 50, 50)}%`,
                            left: (test.deviation || 0) >= 0 ? '50%' : `${50 - Math.min(Math.abs((test.deviation || 0) / 4) * 50, 50)}%`
                          }}
                          className={`absolute top-0 bottom-0 rounded-full ${Math.abs(test.deviation || 0) > 2 ? 'bg-rose-500' : 'bg-blue-500'}`}
                        />
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                   <TrendingUp className="w-5 h-5 text-blue-600" /> BIOMARKER LONGITUDINAL TRENDS
                </h3>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 px-3 py-1 rounded-full bg-slate-50">90-Day Analysis</div>
              </div>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', background: '#fff' }}
                      labelStyle={{ fontWeight: 'black', color: '#0f172a', marginBottom: '8px' }}
                    />
                    <Line type="monotone" dataKey="Hemoglobin" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Hematocrit" stroke="#10b981" strokeWidth={4} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="EPO" stroke="#f43f5e" strokeWidth={4} dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm transition-all hover:border-slate-300">
               <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" /> BIOLOGICAL PASSPORT VALIDATION
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                     <div className="p-4 bg-emerald-100 rounded-2xl">
                        <Heart className="w-6 h-6 text-emerald-600" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stability Index</p>
                        <p className="text-xl font-black text-slate-900">{(athlete.aiInsights?.stabilityIndex * 100 || 84.1).toFixed(1)}%</p>
                     </div>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                     <div className="p-4 bg-blue-100 rounded-2xl">
                        <Shield className="w-6 h-6 text-blue-600" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compliance Status</p>
                        <p className="text-xl font-black text-slate-900">CERTIFIED</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Report Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {athlete.reports.map((report: any) => (
                <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{new Date(report.createdAt).toLocaleDateString()}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(report.createdAt).toLocaleTimeString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                      {report.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      report.status === 'FLAGGED' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest underline underline-offset-4 decoration-blue-200 hover:decoration-blue-400 transition-all">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
