import { useEffect, useState } from 'react';
import { ShieldCheck, Zap, BarChart3, Binary, History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
  Tooltip,
} from 'recharts';
import { api } from '../lib/api.js';

interface MarkerPoint { subject: string; A: number; fullMark: number }
interface SeriesPoint { x: number; y: number; z: number; date: string; atypical: boolean }
interface Overview {
  summary: { totalAthletes: number; flaggedAthletes: number; totalReports: number; flaggedReports: number; anomalyCount: number; auditStatus: string };
  intelligenceMetrics: { complianceRate: number; avgRiskScore: number; modelVersion: string; lastSyncedAt: string; activeSurveillanceNodes: number };
}

export default function AntiDoping() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [markers, setMarkers] = useState<MarkerPoint[]>([]);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ov, mv, lg] = await Promise.all([
        api.antiDoping.getOverview(),
        api.antiDoping.getMarkerVariance(),
        api.antiDoping.getLongitudinal('Hemoglobin'),
      ]);
      setOverview((ov.data as any) ?? null);
      setMarkers((mv.data as any)?.markers ?? []);
      setSeries((lg.data as any)?.series ?? []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load anti-doping intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const runAudit = async () => {
    setAuditing(true);
    try {
      const res = await api.antiDoping.runGlobalAudit();
      const audited = (res.data as any)?.auditedAthletes ?? (res.data as any)?.athletesProcessed ?? 0;
      toast.success(`Global audit completed across ${audited} athletes.`);
      await loadAll();
    } catch (e) {
      console.error(e);
      toast.error('Audit failed.');
    } finally {
      setAuditing(false);
    }
  };

  const m = overview?.intelligenceMetrics;
  const s = overview?.summary;
  const hasMarkers = markers.some((d) => d.A > 0);

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
          <button
            onClick={runAudit}
            disabled={auditing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-60"
          >
            {auditing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Run Global Audit
          </button>
        </div>
      </div>

      {/* KPI strip (real) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Monitored Athletes" value={loading ? '…' : String(s?.totalAthletes ?? 0)} />
        <Kpi label="Under Investigation" value={loading ? '…' : String(s?.flaggedAthletes ?? 0)} accent="text-rose-600" />
        <Kpi label="Anomalies Detected" value={loading ? '…' : String(s?.anomalyCount ?? 0)} accent="text-amber-600" />
        <Kpi label="Compliance Rate" value={loading ? '…' : `${m?.complianceRate ?? 0}%`} accent="text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">Marker Variance vs Baseline</h3>
              <p className="text-xs text-slate-500">Roster-average biomarkers as % of clinical reference (100 = baseline).</p>
            </div>
            <Binary className="w-5 h-5 text-blue-500 opacity-20" />
          </div>
          <div className="h-[300px] w-full">
            {loading ? (
              <Center><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></Center>
            ) : !hasMarkers ? (
              <Center><span className="text-sm text-slate-400 text-center px-6">No biomarker data yet. Upload reports to populate marker variance.</span></Center>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={markers}>
                  <PolarGrid stroke="#f1f5f9" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 150]} tick={{ fill: '#cbd5e1', fontSize: 9 }} />
                  <Tooltip />
                  <Radar name="Roster Avg" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.5} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">Longitudinal Analysis</h3>
              <p className="text-xs text-slate-500">Hemoglobin readings over time (larger + red = atypical).</p>
            </div>
            <BarChart3 className="w-5 h-5 text-indigo-500 opacity-20" />
          </div>
          <div className="h-[300px] w-full">
            {loading ? (
              <Center><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></Center>
            ) : series.length === 0 ? (
              <Center><span className="text-sm text-slate-400 text-center px-6">No hemoglobin readings yet. Upload blood reports to build the passport.</span></Center>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" dataKey="x" name="Test Index" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis type="number" dataKey="y" name="g/dL" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} />
                  <ZAxis type="number" dataKey="z" range={[60, 400]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter name="Hemoglobin" data={series} fill="#4f46e5" />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8">
            <Zap className="w-12 h-12 text-blue-500 animate-pulse" />
          </div>
          <div className="max-w-2xl">
            <h3 className="text-white text-2xl font-black mb-4 tracking-tighter">PREDICTIVE ANOMALY DETECTION</h3>
            <p className="text-slate-400 mb-8 leading-relaxed">
              AI models analyze Biological Passport data to surface atypical physiological patterns. Currently monitoring{' '}
              <span className="text-white font-bold">{s?.totalReports ?? 0}</span> reports across{' '}
              <span className="text-white font-bold">{m?.activeSurveillanceNodes ?? 0}</span> athletes — audit status{' '}
              <span className="text-white font-bold">{s?.auditStatus ?? 'NOMINAL'}</span>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <IntelligenceMetric icon={ShieldCheck} label="Compliance Rate" value={loading ? '…' : `${m?.complianceRate ?? 0}%`} />
              <IntelligenceMetric icon={History} label="Avg Risk Score" value={loading ? '…' : String(m?.avgRiskScore ?? 0)} />
              <IntelligenceMetric icon={Binary} label="Model Version" value={m?.modelVersion ?? '—'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="h-full flex items-center justify-center">{children}</div>;
}

function Kpi({ label, value, accent = 'text-slate-900' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <h4 className={`text-2xl font-black mt-1 ${accent}`}>{value}</h4>
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
  );
}
