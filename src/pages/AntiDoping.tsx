import { ShieldCheck, Zap, BarChart3, Binary, History } from 'lucide-react';
import { motion } from 'motion/react';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

const mockRadarData = [
  { subject: 'Hemoglobin', A: 120, fullMark: 150 },
  { subject: 'Hematocrit', A: 98, fullMark: 150 },
  { subject: 'Reticulocytes', A: 86, fullMark: 150 },
  { subject: 'Steroids', A: 99, fullMark: 150 },
  { subject: 'EPO', A: 85, fullMark: 150 },
  { subject: 'Oxygen', A: 65, fullMark: 150 },
];

const mockPassportData = [
  { x: 1, y: 14.2, z: 100 },
  { x: 2, y: 15.1, z: 100 },
  { x: 3, y: 14.8, z: 100 },
  { x: 4, y: 16.5, z: 150 }, // Spike
  { x: 5, y: 15.9, z: 100 },
  { x: 6, y: 15.2, z: 100 },
];

export default function AntiDoping() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
             <ShieldCheck className="w-8 h-8 text-blue-600" />
             BIOLOGICAL PASSPORT INTELLIGENCE
          </h1>
          <p className="text-slate-500 text-sm font-medium">Advanced pattern detection for atypical physiological variations.</p>
        </div>
        <div className="flex gap-2">
           <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">Run Global Audit</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">Typical Marker Variance</h3>
                  <p className="text-xs text-slate-500">Heuristic comparison against Olympic baseline.</p>
               </div>
               <Binary className="w-5 h-5 text-blue-500 opacity-20" />
            </div>
            <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={mockRadarData}>
                  <PolarGrid stroke="#f1f5f9" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                  <PolarRadiusAxis />
                  <Radar name="Athlete" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.5} />
                  </RadarChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">Longitudinal Analysis</h3>
                  <p className="text-xs text-slate-500">Tracking Hemoglobin (off-score detection).</p>
               </div>
               <BarChart3 className="w-5 h-5 text-indigo-500 opacity-20" />
            </div>
            <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis type="number" dataKey="x" name="Test Index" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                     <YAxis type="number" dataKey="y" name="Value" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} domain={['auto', 'auto']} />
                     <ZAxis type="number" dataKey="z" range={[60, 400]} />
                     <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                     <Scatter name="Tests" data={mockPassportData} fill="#4f46e5" />
                  </ScatterChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="lg:col-span-2 bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
               <Zap className="w-12 h-12 text-blue-500 animate-pulse" />
            </div>
            <div className="max-w-2xl">
               <h3 className="text-white text-2xl font-black mb-4 tracking-tighter">PREDICTIVE ANOMALY DETECTION</h3>
               <p className="text-slate-400 mb-8 leading-relaxed">Our AI models analyze historical Biological Passport data to predict potential future atypical results before they occur. Currently monitoring 12,400+ data points for 142 high-performance athletes.</p>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <IntelligenceMetric icon={ShieldCheck} label="System Confidence" value="98.2%" />
                  <IntelligenceMetric icon={History} label="Historical Match" value="High" />
                  <IntelligenceMetric icon={Binary} label="Model Version" value="V4.2.1" />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

function IntelligenceMetric({ icon: Icon, label, value }: any) {
   return (
      <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 group hover:border-blue-500/50 transition-all">
         <Icon className="w-5 h-5 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
         <h4 className="text-xl font-black text-white mt-1">{value}</h4>
      </div>
   )
}
