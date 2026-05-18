import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle2, AlertCircle, Loader2, Cpu, Brain, Database, ShieldCheck, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { socketClient } from '../services/socket.client.js';

interface UploadDropzoneProps {
  onUploadSuccess: (report: any) => void;
  athleteId: string;
}

const STAGES = [
  { id: 'INGESTION', label: 'Clinical Intake', icon: Upload },
  { id: 'OCR_PARSING', label: 'OCR & Text Extraction', icon: Search },
  { id: 'VALIDATION', label: 'Biomarker Validation', icon: ShieldCheck },
  { id: 'DATA_PERSISTENCE', label: 'Secure Storage', icon: Database },
  { id: 'AI_SCAN', label: 'AI Intelligence Scan', icon: Brain },
];

export default function UploadDropzone({ onUploadSuccess, athleteId }: UploadDropzoneProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [stageStatus, setStageStatus] = useState<Record<string, 'PENDING' | 'LOADING' | 'COMPLETED' | 'FAILED'>>({});

  useEffect(() => {
    if (!uploading) return;

    socketClient.connect();
    socketClient.joinAthlete(athleteId);

    const unsubscribe = socketClient.subscribe('pipeline:update', (data) => {
      if (data.athleteId !== athleteId) return;

      const { stage, status } = data;
      setCurrentStage(stage);
      
      setStageStatus(prev => ({
        ...prev,
        [stage]: status === 'PROCESSING' || status === 'STARTED' || status === 'QUEUED' ? 'LOADING' : 
                 status === 'COMPLETED' || status === 'FINISHED' ? 'COMPLETED' : 
                 status === 'FAILED' ? 'FAILED' : 'PENDING'
      }));

      // Map stages to progress percentages
      const stageIndex = STAGES.findIndex(s => s.id === stage);
      if (stageIndex !== -1) {
        setProgress(Math.max(progress, (stageIndex + 1) * 20));
      }
    });

    return () => unsubscribe();
  }, [uploading, athleteId, progress]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    setError(null);
    setProgress(5);
    setCurrentStage('INGESTION');
    setStageStatus(STAGES.reduce((acc, s) => ({ ...acc, [s.id]: 'PENDING' }), {}));

    const formData = new FormData();
    formData.append('report', acceptedFiles[0]);

    try {
      const response = await fetch(`/api/v1/athletes/${athleteId}/ingest`, {
        method: 'POST',
        body: formData,
      });

      const resJson = await response.json();
      console.log('Ingestion Response:', resJson);

      if (!response.ok) {
        throw new Error(resJson.message || resJson.error || 'Upload failed');
      }

      onUploadSuccess(resJson.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      // Don't close immediately so user can see completion
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
        setCurrentStage(null);
      }, 2000);
    }
  }, [athleteId, onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'text/csv': ['.csv']
    },
    multiple: false
  });

  return (
    <div className="space-y-4">
      <div 
        {...getRootProps()} 
        className={`relative border-2 border-dashed rounded-3xl p-10 transition-all cursor-pointer overflow-hidden ${
          isDragActive ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center text-center">
          {uploading ? (
            <div className="w-full space-y-6 py-4">
              <div className="grid grid-cols-5 gap-2">
                {STAGES.map((s, idx) => {
                  const status = stageStatus[s.id] || 'PENDING';
                  const Icon = s.icon;
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2">
                      <div className={`p-3 rounded-xl transition-all duration-500 ${
                        status === 'COMPLETED' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                        status === 'LOADING' ? 'bg-indigo-600 text-white animate-pulse shadow-lg shadow-indigo-600/20' :
                        status === 'FAILED' ? 'bg-rose-500 text-white' :
                        'bg-slate-100 text-slate-300'
                      }`}>
                        {status === 'LOADING' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
                      </div>
                      <span className={`text-[8px] font-black uppercase tracking-tighter max-w-[60px] leading-tight ${
                        status === 'LOADING' ? 'text-indigo-600' : 'text-slate-400'
                      }`}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] animate-pulse">
                  {STAGES.find(s => s.id === currentStage)?.label || 'INITIALIZING PIPELINE...'}
                </h4>
                <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 animate-ping" />
                  Real-time Intelligence Stream Active
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className={`p-4 rounded-2xl mb-4 ${isDragActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                <Upload className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">
                {isDragActive ? 'DROP TO ANALYZE' : 'UPLOAD MEDICAL REPORT'}
              </h4>
              <p className="text-xs text-slate-400 font-bold max-w-xs leading-relaxed">
                Drag and drop laboratory PDFs, scans, or CSV exports. Our OCR engine will extract biomarkers automatically.
              </p>
            </>
          )}
        </div>

        {uploading && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-100 backdrop-blur-sm">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite]"
            />
          </div>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <p className="text-xs font-black text-rose-700 uppercase tracking-tight">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-center gap-6 mt-4 opacity-50">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">PDF Support</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">OCR Scans</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">CSV Imports</span>
          </div>
      </div>
    </div>
  );
}
