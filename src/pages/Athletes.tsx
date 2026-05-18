import { useEffect, useState } from 'react';
import { Search, Filter, ChevronRight, UserPlus, FileText, Activity, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from 'sonner';

export default function Athletes() {
  const navigate = useNavigate();
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    dateOfBirth: '',
    gender: 'Male',
    nationality: '',
    sport: ''
  });

  const fetchData = () => {
    setLoading(true);
    api.get('/athletes')
      .then(res => setAthletes(res.data.athletes))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/athletes', formData);
      toast.success('Athlete registered successfully');
      setIsModalOpen(false);
      setFormData({ name: '', dateOfBirth: '', gender: 'Male', nationality: '', sport: '' });
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to register athlete');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAthletes = athletes.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.sport.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 pb-20">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-4xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                   <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-600 rounded-2xl">
                         <UserPlus className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">Athlete Enrollment</h2>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Medical Biological Passport Baseline</p>
                      </div>
                   </div>
                   <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                      <X className="w-6 h-6 text-slate-400" />
                   </button>
                </div>

                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Legal Name</label>
                      <input 
                        required
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="e.g. Johnathan Doe" 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:bg-white focus:border-blue-500 transition-all outline-none font-bold"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of Birth</label>
                      <input 
                        required
                        type="date" 
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:bg-white focus:border-blue-500 transition-all outline-none font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                      <select 
                        value={formData.gender}
                        onChange={(e) => setFormData({...formData, gender: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:bg-white focus:border-blue-500 transition-all outline-none font-bold"
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nationality</label>
                      <input 
                        required
                        type="text" 
                        value={formData.nationality}
                        onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                        placeholder="USA" 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:bg-white focus:border-blue-500 transition-all outline-none font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sport Discipline</label>
                      <input 
                        required
                        type="text" 
                        value={formData.sport}
                        onChange={(e) => setFormData({...formData, sport: e.target.value})}
                        placeholder="Athletics" 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:bg-white focus:border-blue-500 transition-all outline-none font-bold"
                      />
                    </div>
                  </div>

                  <button 
                    disabled={isSubmitting}
                    className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? 'ENROLLING...' : (
                      <>Enroll in Intelligence Registry <ArrowRight className="w-5 h-5" /></>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            Athlete Registry
            <span className="text-sm font-medium bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100 italic">
              {athletes.length} Total
            </span>
          </h1>
          <p className="text-slate-500 text-sm">Comprehensive medical and biographical data management.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10"
        >
          <UserPlus className="w-4 h-4" /> Register New Athlete
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 group">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search by name, sport, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border-transparent rounded-xl py-2.5 pl-10 pr-4 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-700 rounded-xl text-sm font-bold border border-transparent hover:border-slate-300 transition-all">
              <Filter className="w-4 h-4" /> Filters
            </button>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[11px] uppercase font-black tracking-widest">
                <th className="px-6 py-4">Athlete Identity</th>
                <th className="px-6 py-4">Status & Nationality</th>
                <th className="px-6 py-4">Sporting Discipline</th>
                <th className="px-6 py-4">Medical Risk Index</th>
                <th className="px-6 py-4">Recent Activity</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-6 h-20">
                      <div className="h-10 bg-slate-100 rounded-lg w-full"></div>
                    </td>
                  </tr>
                ))
              ) : filteredAthletes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-medium">No athletes found matching your search.</td>
                </tr>
              ) : (
                filteredAthletes.map((athlete, i) => (
                  <motion.tr 
                    key={athlete.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate(`/athletes/${athlete.id}`)}
                    className="group border-b border-slate-50 hover:bg-slate-50/80 transition-all cursor-pointer"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-sm font-black text-slate-700 border border-slate-300/50 shadow-sm">
                          {athlete.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-none mb-1.5">{athlete.name}</p>
                          <p className="text-[10px] font-bold text-slate-500 tracking-tighter uppercase font-mono">ID: {athlete.id.split('-')[0]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1.5">
                        <StatusBadge status={athlete.status} />
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">{athlete.nationality}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                         <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center">
                            <Activity className="w-3.5 h-3.5 text-blue-600" />
                         </div>
                         <span className="text-sm font-bold text-slate-800">{athlete.sport}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <RiskIndicator score={athlete.riskScore} />
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-xs font-medium text-slate-500 italic">
                        {athlete.updatedAt ? new Date(athlete.updatedAt).toLocaleDateString() : 'No recent activity'}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                       <div className="flex justify-end gap-2 pr-4">
                          <button className="p-2 text-slate-400 hover:text-blue-600 bg-slate-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                             <FileText className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-slate-900 transition-all">
                             <ChevronRight className="w-5 h-5" />
                          </button>
                       </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    SUSPENDED: 'bg-rose-50 text-rose-700 border-rose-100',
    RETIRED: 'bg-slate-100 text-slate-600 border-slate-200',
    UNDER_INVESTIGATION: 'bg-amber-50 text-amber-700 border-amber-100'
  };
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${styles[status] || styles.ACTIVE}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function RiskIndicator({ score }: { score: number }) {
  const isHigh = score > 75;
  const isMed = score > 40;
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 w-24 bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          className={`h-full rounded-full ${isHigh ? 'bg-gradient-to-r from-red-500 to-rose-600' : isMed ? 'bg-gradient-to-r from-orange-400 to-amber-500' : 'bg-gradient-to-r from-emerald-400 to-green-500'}`} 
        />
      </div>
      <span className={`text-[11px] font-black w-8 ${isHigh ? 'text-rose-600' : isMed ? 'text-amber-600' : 'text-emerald-600'}`}>
        {score.toFixed(1)}
      </span>
    </div>
  );
}
