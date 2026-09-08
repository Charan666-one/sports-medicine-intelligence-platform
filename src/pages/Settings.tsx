import { useState } from 'react';
import { ShieldCheck, KeyRound, Loader2, Copy, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

/**
 * Account security settings — currently just MFA enrollment/management
 * (readiness blocker B2). Kept to one page/section rather than a broader
 * "settings" surface, since MFA is the only account-security control that
 * exists so far.
 */
export default function Settings() {
  const { user, refreshUser } = useAuth();
  const mfaEnabled = Boolean(user?.mfaEnabled);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-indigo-600" />
          ACCOUNT SECURITY
        </h1>
        <p className="text-slate-500 text-sm font-medium italic">Manage two-factor authentication for {user?.email}.</p>
      </div>

      {mfaEnabled ? <MfaEnabledPanel onDisabled={refreshUser} /> : <MfaSetupPanel onEnabled={refreshUser} />}
    </div>
  );
}

function MfaEnabledPanel({ onDisabled }: { onDisabled: () => Promise<void> }) {
  const [showDisable, setShowDisable] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.auth.mfaDisable(password);
      await onDisabled();
      toast.success('Two-factor authentication disabled.');
      setShowDisable(false);
      setPassword('');
    } catch (err: any) {
      setError(err?.serverMessage || err?.message || 'Failed to disable MFA.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border-2 border-emerald-100 shadow-lg shadow-emerald-500/5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900">Two-factor authentication is enabled</h3>
          <p className="text-slate-500 text-sm mt-1">
            Sign-in requires a verification code from your authenticator app (or a backup code) in addition to your password.
          </p>

          {!showDisable ? (
            <button
              onClick={() => setShowDisable(true)}
              className="mt-4 px-4 py-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
            >
              Disable
            </button>
          ) : (
            <form onSubmit={disable} className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-500 mb-1.5 block">Confirm your password to disable</span>
                <input
                  type="password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</div>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-rose-700 disabled:opacity-60 transition-all flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                  Confirm disable
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDisable(false); setError(null); }}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function MfaSetupPanel({ onEnabled }: { onEnabled: () => Promise<void> }) {
  const [step, setStep] = useState<'start' | 'scan' | 'backupCodes'>('start');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const secret = (() => {
    try {
      return new URL(otpauthUrl.replace('otpauth://totp/', 'http://x/')).searchParams.get('secret') ?? '';
    } catch {
      return '';
    }
  })();

  const startSetup = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.auth.mfaSetup();
      setQrCodeDataUrl((res.data as any).qrCodeDataUrl);
      setOtpauthUrl((res.data as any).otpauthUrl);
      setStep('scan');
    } catch (err: any) {
      setError(err?.serverMessage || err?.message || 'Failed to start MFA setup.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.auth.mfaEnable(code);
      setBackupCodes((res.data as any).backupCodes);
      setStep('backupCodes');
    } catch (err: any) {
      setError(err?.serverMessage || err?.message || 'Invalid code — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const finish = async () => {
    await onEnabled();
    toast.success('Two-factor authentication enabled.');
  };

  if (step === 'backupCodes') {
    return (
      <div className="bg-white p-6 rounded-2xl border-2 border-amber-100 shadow-lg shadow-amber-500/5 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <h3 className="font-bold text-slate-900">Save your backup codes</h3>
            <p className="text-slate-500 text-sm mt-1">
              Each code can be used once to sign in if you lose access to your authenticator app. They will not be shown again.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-sm text-slate-900">
          {backupCodes.map((c) => (
            <div key={c}>{c}</div>
          ))}
        </div>
        <button
          onClick={finish}
          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
        >
          I've saved these codes
        </button>
      </div>
    );
  }

  if (step === 'scan') {
    return (
      <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-lg space-y-4">
        <h3 className="font-bold text-slate-900">Scan this QR code</h3>
        <p className="text-slate-500 text-sm">
          Scan with an authenticator app (Google Authenticator, 1Password, Authy), or enter the code manually.
        </p>
        {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="MFA setup QR code" className="w-48 h-48 border border-slate-200 rounded-xl" />}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
          <code className="text-xs text-slate-700 font-mono flex-1 break-all">{secret}</code>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-slate-400 hover:text-slate-700"
            aria-label="Copy secret"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <form onSubmit={confirmCode} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-500 mb-1.5 block">Enter the 6-digit code to confirm</span>
            <input
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 tracking-widest text-center font-mono"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              autoFocus
              required
            />
          </label>
          {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-60 transition-all flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
            Confirm &amp; enable
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-lg">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
          <KeyRound className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900">Two-factor authentication is not enabled</h3>
          <p className="text-slate-500 text-sm mt-1">
            Add a verification code from an authenticator app as a second factor at sign-in — recommended for any account with
            access to athlete medical data.
          </p>
          {error && <div className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{error}</div>}
          <button
            onClick={startSetup}
            disabled={submitting}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-60 transition-all flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
            Enable two-factor authentication
          </button>
        </div>
      </div>
    </div>
  );
}
