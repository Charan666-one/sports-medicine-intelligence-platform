import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, Search, Activity, ShieldCheck, AlertTriangle, 
  ChevronRight, Brain, Cpu, Database, ClipboardCheck, 
  ArrowRight, Download, Eye, Terminal, Loader2, Zap
} from 'lucide-react';
import UploadDropzone from './UploadDropzone.js';
import { api } from '../lib/api.js';

import { toast } from 'sonner';

interface MedicalReportIntelligenceProps {
  athleteId: string;
}

export default function MedicalReportIntelligence({ athleteId }: MedicalReportIntelligenceProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/athletes/${athleteId}/ingestion-history`);
      setHistory(res.data.reports);
      if (res.data.reports.length > 0 && !selectedReport) {
        setSelectedReport(res.data.reports[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [athleteId]);

  useEffect(() => {
    setAiSummary(null);
  }, [selectedReport?.id]);

  const generateSummary = async () => {
    if (!selectedReport) return;
    setGeneratingSummary(true);
    try {
      const res = await api.post(`/reports/${selectedReport.id}/summary`, {});
      setAiSummary(res.data.summary);
      toast.success('AI Medical Summary Generated');
    } catch (error) {
      console.error(error);
      toast.error('AI Reasoning service unavailable');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleUploadSuccess = (data: any) => {
    fetchHistory();
    // The history fetch will update the list, but we can also set the selected report if data contains it
    if (data && data.reportId) {
      toast.success('Intelligence Ingestion Complete');
    }
  };

  useEffect(() => {
    // When history matches a new upload, auto select it
    if (history.length > 0) {
      const latest = history[0];
      if (!selectedReport || (new Date(latest.createdAt) > new Date(selectedReport.createdAt))) {
         setSelectedReport(latest);
      }
    }
  }, [history]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Upload & History */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-8 rounded-4xl border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" /> INGESTION PIPELINE
           </h3>
           <UploadDropzone athleteId={athleteId} onUploadSuccess={handleUploadSuccess} />
        </div>

        <div className="bg-white p-8 rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
           <div className="flex items-center justify-between mb-6">
             <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-400" /> RECENT INGESTIONS
             </h3>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{history.length} FILES</span>
           </div>
           
           <div className="space-y-3">
             {loading ? (
                <div className="py-10 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest animate-pulse">Scanning Archive...</div>
             ) : history.length === 0 ? (
                <div className="py-10 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No Records Found</div>
             ) : (
                history.slice(0, 5).map((report) => (
                  <button 
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                      selectedReport?.id === report.id 
                        ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-500/10' 
                        : 'bg-white border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${selectedReport?.id === report.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate">{report.fileName || 'Report'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(report.createdAt).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${selectedReport?.id === report.id ? 'text-indigo-500' : 'text-slate-300'}`} />
                  </button>
                ))
             )}
           </div>
        </div>
      </div>

      {/* Right Columns: Analysis & Intelligence */}
      <div className="lg:col-span-2 space-y-6">
        <AnimatePresence mode="wait">
          {selectedReport ? (
            <motion.div 
              key={selectedReport.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Report Header & Status */}
              <div className="bg-slate-900 rounded-4xl p-8 text-white relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Cpu className="w-40 h-40" />
                 </div>
                 <div className="relative z-10">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                       <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                         selectedReport.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                       }`}>
                          {selectedReport.status}
                       </span>
                       <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-black uppercase tracking-widest">
                          {selectedReport.type}
                       </span>
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">ID: {selectedReport.id}</span>
                    </div>
                    <h2 className="text-2xl font-black mb-4 truncate">{selectedReport.fileName}</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                       <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase mb-2">OCR Confidence</p>
                          <p className="text-xl font-black">{(selectedReport.ocrConfidence * 100).toFixed(1)}%</p>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Extraction Quality</p>
                          <p className="text-xl font-black text-indigo-400">{selectedReport.extractionQuality || 'N/A'}</p>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Normalization</p>
                          <p className="text-xl font-black text-emerald-400">PASSED</p>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase mb-2">AI Ready</p>
                          <p className="text-xl font-black flex items-center gap-2">
                             ACTIVE <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          </p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Biomarker Extraction Table */}
              <div className="bg-white p-8 rounded-4xl border border-slate-200 shadow-sm">
                 <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 underline decoration-indigo-500 underline-offset-8">
                    <Activity className="w-5 h-5 text-indigo-600" /> EXTRACTED BIOMARKERS
                 </h3>
                 <div className="overflow-hidden border border-slate-100 rounded-3xl">
                    <table className="w-full">
                       <thead>
                          <tr className="bg-slate-50">
                             <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Parameter</th>
                             <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Extracted Value</th>
                             <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Medical Unit</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                          {selectedReport.testResults?.map((res: any) => (
                             <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 font-black text-slate-900 text-sm tracking-tight capitalize">{res.parameter.replace('_', ' ')}</td>
                                <td className="px-6 py-4 font-black text-slate-900 text-lg">
                                   <motion.span 
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      className="tabular-nums"
                                   >
                                      {res.value}
                                   </motion.span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                      {res.unit}
                                   </span>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Intelligence summary */}
                  <div className="bg-white p-8 rounded-4xl border border-slate-200 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                         <Brain className="w-5 h-5 text-indigo-600" /> AI CLINICAL SUMMARY
                      </h3>
                      {!aiSummary && (
                        <button 
                          disabled={generatingSummary}
                          onClick={generateSummary}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {generatingSummary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          Generate Summary
                        </button>
                      )}
                    </div>
                    <div className="flex-1 p-6 bg-slate-50 rounded-3xl border border-slate-100 relative group min-h-[120px]">
                       <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                          <Brain className="w-20 h-20" />
                       </div>
                       <p className="text-slate-900 font-bold leading-relaxed italic relative z-10 text-sm">
                          {aiSummary || selectedReport.validationNotes || 'No automated clinical summary available for this document entry. Click generate for AI reasoning.'}
                       </p>
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                       <ShieldCheck className="w-4 h-4" /> Physician Review Recommended
                    </div>
                  </div>

                 {/* OCR Preview placeholder / Raw Text */}
                 <div className="bg-slate-50 p-8 rounded-4xl border border-slate-200 shadow-inner flex flex-col">
                    <h3 className="font-bold text-slate-400 mb-6 flex items-center gap-2">
                       <Terminal className="w-5 h-5" /> OCR RAW STREAM
                    </h3>
                    <div className="flex-1 bg-black rounded-2xl p-4 font-mono text-[10px] text-emerald-500 overflow-auto max-h-[300px]">
                       <div className="mb-2 text-slate-500">// EXTRACTED ON {new Date(selectedReport.createdAt).toISOString()}</div>
                       <pre className="whitespace-pre-wrap">{selectedReport.ocrRawText || "// NULL_STREAM"}</pre>
                    </div>
                 </div>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-20 text-center bg-slate-50 rounded-4xl border border-dashed border-slate-300">
               <div className="p-6 bg-white rounded-full shadow-sm mb-6">
                  <Search className="w-10 h-10 text-slate-300" />
               </div>
               <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase mb-2">No Document Selected</h3>
               <p className="text-slate-400 font-bold max-w-xs text-sm">
                  Select a report from the history or ingest a new document to view the medical intelligence breakdown.
               </p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
