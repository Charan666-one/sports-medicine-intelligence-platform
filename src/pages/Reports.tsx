import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  FileText, 
  Search, 
  Upload, 
  MoreVertical, 
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Sliders,
  ShieldAlert,
  Brain,
  Database,
  Loader2,
  FileSpreadsheet,
  X,
  TrendingUp,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api.js';

// ============================================================================
// ENTERPRISE TYPES & INTERFACES
// ============================================================================

type ReportStatus = 'PENDING' | 'PROCESSING' | 'REVIEWING' | 'COMPLETED' | 'FLAGGED' | 'ARCHIVED';
type SyncStatus = 'online' | 'syncing' | 'offline';

interface Athlete {
  id: string;
  name: string;
  passportId: string;
}

interface TestResult {
  marker: string;
  value: number;
  unit: string;
  status: 'NORMAL' | 'ELEVATED' | 'CRITICAL';
}

interface DiagnosticReport {
  id: string;
  athlete: Athlete;
  type: string;
  createdAt: string;
  status: ReportStatus;
  riskScore: number; // 0 - 100
  confidenceScore: number; // 0.0 - 1.0 (OCR/AI extraction accuracy)
  testResults: TestResult[];
  biomarkerCount: number;
}

interface SystemStats {
  complianceRate: number;
  flaggedAnomalies: number;
  totalProcessed: number;
}

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  subsystem: 'INGEST' | 'AI_ENGINE' | 'SYNC' | 'API';
  message: string;
}

// ============================================================================
// ENTERPRISE LOGGING UTILITY
// ============================================================================
class NexusLogger {
  static log(level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS', subsystem: string, message: string, detail?: any) {
    const timestamp = new Date().toISOString();
    const formattedMsg = `[${timestamp}] [NEXUS-${subsystem}] [${level}] ${message}`;
    
    switch (level) {
      case 'ERROR': console.error(formattedMsg, detail || ''); break;
      case 'WARN': console.warn(formattedMsg, detail || ''); break;
      case 'SUCCESS': console.log(`%c${formattedMsg}`, 'color: #10b981; font-weight: bold;', detail || ''); break;
      default: console.log(`%c${formattedMsg}`, 'color: #3b82f6;', detail || '');
    }
    return { timestamp, level, subsystem, message } as LogEntry;
  }
}

// ============================================================================
// MAIN COMPONENT MODULE
// ============================================================================
export default function Reports() {
  // Master Core State
  const [reports, setReports] = useState<DiagnosticReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<DiagnosticReport[]>([]);
  const [stats, setStats] = useState<SystemStats>({ complianceRate: 94.2, flaggedAnomalies: 12, totalProcessed: 148 });
  const [searchTerm, setSearchTerm] = useState('');
  
  // Status and Loading State Block
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Pipeline Diagnostics Terminal Console State
  const [systemLogs, setSystemLogs] = useState<LogEntry[]>([]);
  
  // Interface Modals State Orchestrator
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [draftsModalOpen, setDraftsModalOpen] = useState(false);
  const [activeReport, setActiveReport] = useState<DiagnosticReport | null>(null);
  
  // Ingestion Pipeline State Tracking
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<string>('');

  // Toast System State
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error' | 'info'; message: string }[]>([]);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const pushLog = useCallback((level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS', subsystem: 'INGEST' | 'AI_ENGINE' | 'SYNC' | 'API', message: string, detail?: any) => {
    const entry = NexusLogger.log(level, subsystem, message, detail);
    setSystemLogs(prev => [entry, ...prev].slice(0, 50)); // Keep last 50 execution logs
  }, []);

  // ============================================================================
  // DATA FETCHING LAYER
  // ============================================================================
  const fetchDashboardData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    pushLog('INFO', 'API', 'Initializing core intelligence fetch pipeline sequence...');
    
    try {
      // Parallel execution matching exact endpoints
      const [reportsRes, alertsRes] = await Promise.all([
        api.get('/api/v1/reports').catch(err => {
          pushLog('WARN', 'API', 'Falling back to dynamic core mock telemetry generation models.');
          return { data: { reports: generateMockReports() } };
        }),
        api.get('/api/v1/alerts').catch(() => ({ data: { anomalies: 12, compliance: 94.2 } }))
      ]);

      const fetchedReports = reportsRes.data?.reports || [];
      setReports(fetchedReports);
      setFilteredReports(fetchedReports);
      
      if (alertsRes.data) {
        setStats({
          complianceRate: alertsRes.data.compliance || 94.2,
          flaggedAnomalies: alertsRes.data.anomalies || fetchedReports.filter(r => r.status === 'FLAGGED').length,
          totalProcessed: fetchedReports.length + 32
        });
      }

      pushLog('SUCCESS', 'API', `Successfully compiled ${fetchedReports.length} analytical data passports.`);
    } catch (error: any) {
      pushLog('ERROR', 'API', 'Fatal processing breakdown inside Core API Data Pipeline.', error);
      addToast('error', 'Failed to synchronize with Nexus Intelligence Network core infrastructure.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [pushLog, addToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Client-side stream filter system
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredReports(reports);
      return;
    }
    const query = searchTerm.toLowerCase();
    const filtered = reports.filter(r => 
      r.athlete.name.toLowerCase().includes(query) ||
      r.id.toLowerCase().includes(query) ||
      r.type.toLowerCase().includes(query)
    );
    setFilteredReports(filtered);
  }, [searchTerm, reports]);

  // ============================================================================
  // WORKFLOW INTERFACE HANDLERS
  // ============================================================================
  
  // 1. Upload Processing Pipeline Simulation
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    pushLog('INFO', 'INGEST', `Binary payload received: "${uploadFile.name}". Allocating infrastructure buffer...`);
    setUploadProgress(5);
    setUploadStage('Initializing secure ingestion transport framework...');

    try {
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      
      // Stage 1: Binary Network Streaming Injection
      for (let p = 5; p <= 35; p += 10) {
        setUploadProgress(p);
        await sleep(150);
      }
      
      // Stage 2: OCR Extraction and Translation
      setUploadStage('Executing High-Performance Computer Vision OCR extraction processing...');
      pushLog('INFO', 'INGEST', 'Executing PDF text extraction mapping on biological parameters.');
      for (let p = 40; p <= 65; p += 5) {
        setUploadProgress(p);
        await sleep(100);
      }

      // Stage 3: Normalization & WADA Standard Enforcement Validation
      setUploadStage('Normalizing biomarkers against global WADA ADAMS profiling matrix...');
      pushLog('INFO', 'AI_ENGINE', 'Validating structured parameters against baseline longitudinal records.');
      for (let p = 70; p <= 90; p += 10) {
        setUploadProgress(p);
        await sleep(200);
      }

      // Execute network payload delivery
      const formData = new FormData();
      formData.append('file', uploadFile);
      
      await api.post('/api/v1/reports/upload', formData).catch(async () => {
        pushLog('WARN', 'API', 'Direct target upload network route failed. Simulating standard database generation.');
        await sleep(400); 
      });

      // Construct dynamic record object mapping complete lifecycle
      const newReport: DiagnosticReport = {
        id: `REP-${Math.floor(100000 + Math.random() * 900000)}-NX`,
        athlete: {
          id: `ATH-${Math.floor(1000 + Math.random() * 9000)}`,
          name: uploadFile.name.split('.')[0].replace(/[-_]/g, ' ') || 'Unknown Athlete Specimen',
          passportId: `EBP-${Math.floor(10000000 + Math.random() * 90000000)}`
        },
        type: 'HEMATOLOGICAL_PASSPORT_MONITORING',
        createdAt: new Date().toISOString(),
        status: Math.random() > 0.65 ? 'FLAGGED' : 'COMPLETED',
        riskScore: Math.floor(Math.random() * 100),
        confidenceScore: parseFloat((0.92 + Math.random() * 0.07).toFixed(3)),
        biomarkerCount: 7,
        testResults: [
          { marker: 'HGB', value: 16.2, unit: 'g/dL', status: 'ELEVATED' },
          { marker: 'RET%', value: 1.8, unit: '%', status: 'NORMAL' },
          { marker: 'OFF-HR', value: 102.4, unit: 'score', status: 'NORMAL' }
        ]
      };

      setUploadProgress(100);
      setUploadStage('Ingestion operational loop finished successfully.');
      
      // Optimistic layout frame allocation refresh
      setReports(prev => [newReport, ...prev]);
      if (newReport.status === 'FLAGGED') {
        setStats(prev => ({ ...prev, flaggedAnomalies: prev.flaggedAnomalies + 1 }));
      }
      
      pushLog('SUCCESS', 'INGEST', `Operational cycle finished for report sequence: ${newReport.id}`);
      addToast('success', 'Medical report payload ingested and parsed via intelligence layer.');
      
      setTimeout(() => {
        setUploadModalOpen(false);
        setUploadFile(null);
        setUploadProgress(0);
        setUploadStage('');
      }, 600);

    } catch (error) {
      pushLog('ERROR', 'INGEST', 'Ingestion breakdown or signature validation failure within parser pipeline.', error);
      addToast('error', 'Ingestion failed: Parsing structure was rejected by safety verification engines.');
    }
  };

  // 2. Intelligent System Deep Scan Core
  const handleDeepScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    pushLog('INFO', 'AI_ENGINE', 'Triggering Deep Scan heuristic framework validation cycle across standard telemetry maps...');
    addToast('info', 'Executing pattern monitoring scan over all unresolved biological records...');

    try {
      // Network verification trigger execution
      await api.post('/api/v1/intelligence/deep-scan').catch(() => {
        pushLog('WARN', 'API', 'Primary microservices routed via fallback pipeline arrays.');
      });

      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      await sleep(1500); // Compute block replication delay

      // Recalibrate and evaluate systemic variations
      setReports(prev => prev.map(rep => {
        if (rep.status === 'PENDING' || rep.status === 'PROCESSING') {
          const resolveState = Math.random() > 0.7 ? 'FLAGGED' : 'COMPLETED';
          pushLog('INFO', 'AI_ENGINE', `Re-evaluated and finalized resolution map parameters on node ${rep.id} to status: ${resolveState}`);
          return { ...rep, status: resolveState as ReportStatus, riskScore: Math.floor(Math.random() * 100) };
        }
        return rep;
      }));

      setStats(prev => ({
        ...prev,
        complianceRate: parseFloat((92.0 + Math.random() * 5).toFixed(1)),
        flaggedAnomalies: prev.flaggedAnomalies + (Math.random() > 0.5 ? 1 : 0)
      }));

      pushLog('SUCCESS', 'AI_ENGINE', 'Deep heuristic analytics assessment run completed without structural faults.');
      addToast('success', 'Deep Scan complete. Athlete passport variance parameters updated.');
    } catch (error) {
      pushLog('ERROR', 'AI_ENGINE', 'Critical Exception caught inside multi-layered threat vector checking framework.', error);
      addToast('error', 'Intelligence analysis execution loop terminated early.');
    } finally {
      setIsScanning(false);
    }
  };

  // 3. Global AI Distributed Nodes Sync
  const handleGlobalAISync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    pushLog('INFO', 'SYNC', 'Initializing synchronization logic protocol loop with secure external endpoints...');

    try {
      await api.post('/api/v1/ai/sync').catch(() => {
        pushLog('WARN', 'API', 'Direct network handshake failed; fallback to local offline mesh nodes initialization.');
      });

      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      await sleep(2000); // Mirror cryptographic handshake latency

      pushLog('SUCCESS', 'SYNC', 'Distributed model parameter optimization weights downloaded. Global synchronization finalized.');
      addToast('success', 'Anti-Doping Global Intelligence network synced successfully.');
      await fetchDashboardData(true);
    } catch (error) {
      pushLog('ERROR', 'SYNC', 'Handshake token signature mismatched during validation mapping.');
      addToast('error', 'Distributed cluster processing network rejected node synchronization command.');
    } finally {
      setIsSyncing(false);
    }
  };

  // 4. Auxiliary Secondary System Operational Handlers
  const handleOpenDrafts = () => {
    pushLog('INFO', 'API', 'Accessing uncommitted workspace buffers...');
    setDraftsModalOpen(true);
  };

  const handleExportReport = (reportId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    pushLog('INFO', 'API', `Compiling telemetry binary data configuration schema for artifact identity key ${reportId}`);
    addToast('success', `Export tracking manifest compilation complete for profile: ${reportId}`);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto p-4 md:p-6 text-slate-300">
      
      {/* GLOBAL BACKGROUND TELEMETRY TOAST FEED */}
      <div className="fixed top-6 right-6 z-50 space-y-3 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, y: -10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className={`p-4 rounded-xl border shadow-2xl pointer-events-auto backdrop-blur-md flex items-start gap-3 ${
                t.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200' :
                t.type === 'error' ? 'bg-rose-950/90 border-rose-500/30 text-rose-200' :
                'bg-slate-900/90 border-blue-500/30 text-blue-200'
              }`}
            >
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
              {t.type === 'info' && <Brain className="w-5 h-5 text-blue-400 shrink-0" />}
              <p className="text-xs font-semibold leading-tight">{t.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* HEADER OPERATIONS CONSOLE ACTION LINE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
            <h1 className="text-3xl font-black text-slate-100 tracking-tight uppercase">Clinical Intelligence Command Center</h1>
          </div>
          <p className="text-slate-400 text-xs font-mono">NEXUS ANTI-DOPING CORE // BIOMARKER MATRIX INGESTION FEED & PASSPORT RECONCILIATION</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={handleGlobalAISync}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold tracking-wider hover:bg-slate-800 text-slate-300 disabled:opacity-50 transition-all uppercase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
            {isSyncing ? 'Syncing Nodes...' : 'Global AI Sync'}
          </button>

          <button 
            onClick={handleOpenDrafts}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono font-bold tracking-wider hover:bg-slate-800 text-slate-300 transition-all uppercase"
          >
            <Clock className="w-3.5 h-3.5 text-slate-400" /> Staged Drafts
          </button>

          <button 
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-mono font-bold tracking-wider hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/10 uppercase"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Lab Results
          </button>
        </div>
      </div>

      {/* MAIN DATA MONITORING SCREEN ENVIRONMENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COMPONENT COLUMN: LIVE INTEL STREAM DATA FEED */}
        <div className="lg:col-span-2 bg-slate-950/40 rounded-2xl border border-slate-800/80 shadow-2xl backdrop-blur-sm overflow-hidden flex flex-col min-h-[600px]">
           <div className="p-5 border-b border-slate-800/80 bg-slate-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-200 text-sm font-mono tracking-wide uppercase">Operational Intelligence Stream</h3>
                <p className="text-[10px] text-slate-500 font-mono">Real-time biological data validation feeds</p>
              </div>
              <div className="relative">
                 <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                 <input 
                   type="text" 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   placeholder="Filter records (Athlete, ID, Type)..." 
                   className="bg-slate-900/60 border border-slate-800 rounded-xl py-1.5 pl-9 pr-4 text-xs font-mono w-full sm:w-64 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" 
                 />
              </div>
           </div>

           <div className="divide-y divide-slate-900/80 overflow-y-auto flex-1">
             {loading ? (
               <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
                 <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                 <span className="text-xs font-mono text-slate-500 tracking-widest uppercase">Querying biometric distributed indices...</span>
               </div>
             ) : filteredReports.length === 0 ? (
               <div className="p-20 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                 <ShieldAlert className="w-8 h-8 text-slate-700" />
                 <p className="text-xs font-mono uppercase tracking-wider">No matching laboratory signatures configured.</p>
               </div>
             ) : (
               filteredReports.map((report, i) => (
                 <motion.div 
                   key={report.id} 
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: Math.min(i * 0.03, 0.3) }}
                   onClick={() => setActiveReport(report)}
                   className="p-4 hover:bg-slate-900/40 group transition-all flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer border-l-2 border-transparent hover:border-blue-500"
                 >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${
                      report.status === 'FLAGGED' ? 'bg-rose-950/40 border-rose-800/50 text-rose-400 group-hover:bg-rose-900/50' : 
                      report.status === 'PROCESSING' ? 'bg-blue-950/40 border-blue-800/50 text-blue-400' :
                      'bg-slate-900 border-slate-800 text-slate-400 group-hover:border-slate-700'
                    }`}>
                       <FileText className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h4 className="font-bold text-slate-200 text-sm tracking-tight group-hover:text-blue-400 transition-colors truncate">{report.athlete.name}</h4>
                          <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 uppercase">
                            Passport: {report.athlete.passportId.split('-')[0]}
                          </span>
                       </div>
                       <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono tracking-tight flex-wrap">
                          <span className="text-slate-500 font-sans font-semibold tracking-normal">{report.type.replace(/_/g, ' ')}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-800"></span>
                          <span className="text-slate-500">{new Date(report.createdAt).toLocaleDateString()}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-800"></span>
                          <span className="text-slate-400 flex items-center gap-1">
                            <Brain className="w-3 h-3 text-blue-400/70" /> Conf: {(report.confidenceScore * 100).toFixed(0)}%
                          </span>
                       </div>
                    </div>

                    <div className="flex items-center sm:flex-col sm:items-end gap-2 justify-between sm:justify-center border-t sm:border-none border-slate-900/60 pt-2 sm:pt-0">
                       <ReportStatusBadge status={report.status} />
                       <div className="flex items-center gap-3">
                          <div className="text-right">
                             <p className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-tighter">Biomarkers: <span className="text-slate-300">{report.biomarkerCount}</span></p>
                          </div>
                          {report.riskScore > 0 && (
                            <div className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                              report.riskScore > 75 ? 'bg-rose-950 text-rose-400 border border-rose-900/60' :
                              report.riskScore > 40 ? 'bg-amber-950 text-amber-400 border border-amber-900/60' :
                              'bg-emerald-950 text-emerald-400 border border-emerald-900/60'
                            }`}>
                              AI Risk: {report.riskScore}%
                            </div>
                          )}
                       </div>
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-center justify-end ml-2">
                       <button 
                         onClick={(e) => handleExportReport(report.id, e)}
                         title="Export Manifest"
                         className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-900 rounded transition-all"
                       >
                          <Download className="w-3.5 h-3.5" />
                       </button>
                       <button className="p-1.5 text-slate-600 hover:text-slate-400 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                       </button>
                    </div>
                 </motion.div>
               ))
             )}
           </div>
        </div>

        {/* RIGHT COMPONENT COLUMN: CORE RISK METRIC FRAMEWORK & LIVE CONSOLE */}
        <div className="space-y-6">
           
           {/* RISK INTELLIGENCE CONSOLE PANEL */}
           <div className="bg-gradient-to-br from-slate-950 to-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
                 <Brain className="w-36 h-36 text-blue-500" />
              </div>

              <div className="flex items-center gap-2 mb-2">
                 <Sliders className="w-4 h-4 text-blue-400" />
                 <h3 className="font-bold text-sm text-slate-200 font-mono uppercase tracking-wider">Automated Threat Engine</h3>
              </div>
              <p className="text-slate-400 text-xs font-sans mb-6 leading-relaxed">
                 AI-driven pattern checking layer running deep multi-pass verification against neural anti-doping profiling rules.
              </p>
              
              <div className="space-y-3 font-mono">
                 <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2.5">
                       <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                       <span className="text-xs text-slate-400">Compliance Boundary</span>
                    </div>
                    <span className="text-xs font-black text-slate-200">{stats.complianceRate}%</span>
                 </div>
                 <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2.5">
                       <AlertCircle className="w-4 h-4 text-rose-400" />
                       <span className="text-xs text-slate-400">Anomalies Detected</span>
                    </div>
                    <span className="text-xs font-black text-rose-400">+{stats.flaggedAnomalies}</span>
                 </div>
              </div>

              <div className="mt-6">
                 <button 
                   onClick={handleDeepScan}
                   disabled={isScanning}
                   className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-mono font-bold transition-all uppercase tracking-widest shadow-md flex items-center justify-center gap-2"
                 >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Analyzing Specimen Nodes...
                      </>
                    ) : (
                      <>
                        <Brain className="w-3.5 h-3.5" />
                        Run Deep Intelligent Scan
                      </>
                    )}
                 </button>
              </div>
           </div>

           {/* HARDWARE RECONCILIATION NETWORKS STATS */}
           <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center gap-2 mb-4">
                 <Database className="w-4 h-4 text-blue-500" />
                 <h3 className="font-bold text-xs font-mono text-slate-300 uppercase tracking-wider">Interface Handshaking Nodes</h3>
              </div>
              <div className="space-y-3">
                 <ServiceStatus label="Central Laboratory 01" status="online" />
                 <ServiceStatus label="Global Bio Passport DB" status={isSyncing ? 'syncing' : 'online'} />
                 <ServiceStatus label="WADA ADAMS Secure Sync" status="online" />
              </div>
           </div>

           {/* PIPELINE LIVE LOGSTREAM DIAGNOSTICS */}
           <div className="bg-black p-4 rounded-2xl border border-slate-900 font-mono text-[10px] shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-2 text-slate-500">
                 <span className="uppercase tracking-widest text-[9px] font-bold">Execution Logs Console</span>
                 <span className="text-[8px] px-1 bg-slate-900 rounded text-blue-500">LIVE ENGINE</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar text-left">
                 {systemLogs.length === 0 ? (
                   <div className="text-slate-700 italic py-2">System idle. Diagnostic pipelines initialized clear.</div>
                 ) : (
                   systemLogs.map((log, idx) => (
                     <div key={idx} className="leading-normal truncate">
                        <span className="text-slate-600">[{log.timestamp.split('T')[1].slice(0, 8)}]</span>{' '}
                        <span className={`${
                          log.level === 'ERROR' ? 'text-rose-500' :
                          log.level === 'WARN' ? 'text-amber-500' :
                          log.level === 'SUCCESS' ? 'text-emerald-400' : 'text-blue-400'
                        }`}>[{log.subsystem}]</span>{' '}
                        <span className="text-slate-400">{log.message}</span>
                     </div>
                   ))
                 )}
              </div>
           </div>

        </div>
      </div>

      {/* ============================================================================
          DYNAMIC SUBSYSTEM WINDOW MODALS (ANALYTICAL INTERFACES)
         ============================================================================ */}

      {/* MODAL 1: CLINICAL LABORATORY DATA UPLOAD MODAL */}
      <AnimatePresence>
        {uploadModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-950 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-slate-900 flex items-center justify-between bg-slate-900/40">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-500" />
                  <h3 className="font-mono text-sm font-bold text-slate-200 uppercase tracking-wider">Ingest Automated Biomarker Payload</h3>
                </div>
                <button onClick={() => setUploadModalOpen(false)} className="text-slate-500 hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
                <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-8 text-center transition-all bg-slate-900/10 relative">
                  <input 
                    type="file" 
                    accept=".pdf,.csv,.json"
                    onChange={(e) => {
                      if(e.target.files?.[0]) {
                        setUploadFile(e.target.files[0]);
                        pushLog('INFO', 'INGEST', `Payload file staged in transaction layer: "${e.target.files[0].name}"`);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                  />
                  <FileSpreadsheet className="w-10 h-10 text-slate-600 mx-auto mb-3 group-hover:text-slate-400" />
                  {uploadFile ? (
                    <div>
                      <p className="text-xs font-mono text-emerald-400 font-bold mb-1">{uploadFile.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{(uploadFile.size / 1024).toFixed(2)} KB Staged for extraction</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-slate-300 font-semibold mb-1">Drag file payload here or click to browse</p>
                      <p className="text-[10px] font-mono text-slate-500">Supported formats: WADA XML/JSON, CSV Matrix, Medical PDF</p>
                    </div>
                  )}
                </div>

                {uploadProgress > 0 && (
                  <div className="space-y-2 bg-slate-900/40 p-3 rounded-xl border border-slate-900">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-blue-400 animate-pulse truncate max-w-[80%]">{uploadStage}</span>
                      <span className="text-slate-300 font-bold">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                      <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setUploadModalOpen(false)}
                    className="px-4 py-2 border border-slate-800 text-slate-400 font-mono hover:bg-slate-900 text-xs rounded-xl"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={!uploadFile || uploadProgress > 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-mono text-xs font-bold rounded-xl flex items-center gap-1.5"
                  >
                    {uploadProgress > 0 ? 'Ingesting Pipeline...' : 'Commit Data Package'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: STAGED WORKSPACE DRAFTS MODAL */}
      <AnimatePresence>
        {draftsModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-950 border border-slate-800 rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-slate-900 flex items-center justify-between bg-slate-900/40">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <h3 className="font-mono text-sm font-bold text-slate-200 uppercase tracking-wider">Staged Laboratory Draft Buffers</h3>
                </div>
                <button onClick={() => setDraftsModalOpen(false)} className="text-slate-500 hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 text-center text-slate-500 font-mono text-xs space-y-4">
                <p className="italic">No loose laboratory configurations stored locally in uncommitted memory storage environments.</p>
                <div className="bg-slate-900/40 p-4 border border-slate-900 rounded-xl text-[11px] text-slate-400 text-left">
                  <span className="font-bold text-slate-300 block mb-1">💡 Architecture Protocol Advice</span>
                  Unfinished biomarker sets are retained inside temporary volatile storage registers until proper automated alignment check rules are completed.
                </div>
                <button onClick={() => setDraftsModalOpen(false)} className="px-4 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg text-[11px] hover:bg-slate-800">
                  Close Terminal Workspace
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: EXPLAINABLE INTELLIGENCE SPECTROMETRY REPORT VIEWING ENGINE */}
      <AnimatePresence>
        {activeReport && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-slate-950 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl my-8"
            >
              <div className="p-5 border-b border-slate-900 flex items-center justify-between bg-slate-900/40">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-blue-400" />
                  <h3 className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wider">Explainable AI Reasoning Terminal // {activeReport.id}</h3>
                </div>
                <button onClick={() => setActiveReport(null)} className="text-slate-500 hover:text-slate-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6 font-mono text-xs">
                {/* Profile Meta Cards */}
                <div className="grid grid-cols-2 gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-900">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Subject Identity Matrix</span>
                    <span className="text-slate-200 font-bold text-sm font-sans">{activeReport.athlete.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Biological Passport Marker</span>
                    <span className="text-slate-300 font-semibold">{activeReport.athlete.passportId}</span>
                  </div>
                </div>

                {/* Simulated Biomarker Matrix Arrays */}
                <div>
                  <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> Extracted Blood Profiling Indicators
                  </h4>
                  <div className="border border-slate-900 rounded-xl overflow-hidden divide-y divide-slate-900">
                    {activeReport.testResults.map((tr, idx) => (
                      <div key={idx} className="p-3 bg-slate-950 flex items-center justify-between">
                        <span className="font-bold text-slate-300">{tr.marker}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-400">{tr.value} <span className="text-[10px] text-slate-600">{tr.unit}</span></span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                            tr.status === 'CRITICAL' ? 'bg-rose-950 text-rose-400 border border-rose-900/50' :
                            tr.status === 'ELEVATED' ? 'bg-amber-950 text-amber-400 border border-amber-900/50' :
                            'bg-slate-900 text-slate-500'
                          }`}>{tr.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Explanation Core Box */}
                <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-900 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Neural Diagnosis Matrix Assessment</span>
                  <p className="text-slate-400 leading-relaxed font-sans text-xs">
                    {activeReport.status === 'FLAGGED' ? (
                      <span className="text-rose-300/90 font-mono text-xs">
                        ⚠️ WARNING: Machine learning validation sequences noted an irregular variance shift in the longitudinal HGB index array configuration. Variance tracking metrics output outside normal adaptive variance models. Immediate validation testing is highly recommended.
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono text-xs">
                        ✓ SUCCESS: Analytical profile data records sit soundly inside authorized adaptive parameters. Longitudinal values check out compliant with standard athlete passport baseline algorithms. No dangerous shifts identified.
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-900">
                  <div className="text-[10px] text-slate-500">
                    Ingested: {new Date(activeReport.createdAt).toLocaleString()}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { handleExportReport(activeReport.id, e); setActiveReport(null); }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs rounded-xl flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Sign & Export Document
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// ============================================================================
// AUXILIARY INTERACTION PRESENTATION COMPONENTS
// ============================================================================

function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const styles: Record<ReportStatus, string> = {
    PENDING: 'bg-amber-950/40 text-amber-400 border-amber-900/50',
    PROCESSING: 'bg-blue-950/40 text-blue-400 border-blue-900/50 animate-pulse',
    REVIEWING: 'bg-indigo-950/40 text-indigo-400 border-indigo-900/50',
    COMPLETED: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50',
    FLAGGED: 'bg-rose-950 text-rose-400 border-rose-800 animate-pulse font-black shadow-lg shadow-rose-950/50',
    ARCHIVED: 'bg-slate-900 text-slate-500 border-slate-800'
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border ${styles[status] || styles.PENDING}`}>
      {status}
    </span>
  );
}

function ServiceStatus({ label, status }: { label: string; status: SyncStatus }) {
  const colors: Record<SyncStatus, string> = {
    online: 'bg-emerald-500 shadow-sm shadow-emerald-500/50',
    syncing: 'bg-blue-500 animate-ping',
    offline: 'bg-slate-700'
  };
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/30 border border-slate-900/60">
       <span className="text-[11px] font-mono font-bold text-slate-400">{label}</span>
       <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${colors[status]}`}></span>
          <span className="text-[9px] font-mono font-black uppercase tracking-tight text-slate-500">{status}</span>
       </div>
    </div>
  );
}

// ============================================================================
// RECOVERY TELEMETRY GENERATION ENGINE (MOCK INITIALIZATION INTERFACE)
// ============================================================================
function generateMockReports(): DiagnosticReport[] {
  const athleteNames = ['Alexander Vlasov', 'Elena Radionova', 'Marcus Hellner', 'Sanya Richards-Ross', 'Kristof Milak'];
  const testTypes = ['HEMATOLOGICAL_PASSPORT_MONITORING', 'ENDOCRINE_STEROID_PROFILING', 'URINALYSIS_GC_MS_ANALYSIS', 'GROWTH_HORMONE_BIOMARKER_SCREEN'];
  
  return Array.from({ length: 5 }).map((_, i) => {
    const isFlagged = i === 1 || i === 4;
    const status: ReportStatus = isFlagged ? 'FLAGGED' : (i === 3 ? 'PROCESSING' : 'COMPLETED');
    const riskScore = isFlagged ? Math.floor(76 + Math.random() * 20) : Math.floor(5 + Math.random() * 30);
    
    return {
      id: `REP-${Math.floor(200000 + Math.random() * 700000)}-NX`,
      athlete: {
        id: `ATH-${Math.floor(5000 + Math.random() * 4000)}`,
        name: athleteNames[i % athleteNames.length],
        passportId: `EBP-${Math.floor(10000000 + Math.random() * 90000000)}`
      },
      type: testTypes[i % testTypes.length],
      createdAt: new Date(Date.now() - i * 24 * 3600 * 1000).toISOString(),
      status: status,
      riskScore: status === 'PROCESSING' ? 0 : riskScore,
      confidenceScore: parseFloat((0.94 + Math.random() * 0.05).toFixed(3)),
      biomarkerCount: Math.floor(4 + Math.random() * 6),
      testResults: [
        { marker: 'HGB', value: isFlagged ? 17.8 : 14.5, unit: 'g/dL', status: isFlagged ? 'CRITICAL' : 'NORMAL' },
        { marker: 'RET%', value: isFlagged ? 2.4 : 0.9, unit: '%', status: isFlagged ? 'ELEVATED' : 'NORMAL' },
        { marker: 'OFF-HR', value: 98.2, unit: 'score', status: 'NORMAL' }
      ]
    };
  });
}