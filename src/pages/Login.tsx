import { useState } from 'react';
import { ShieldCheck, Loader2, Lock, Mail, User, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export default function Login() {
  const { login, mfaChallenge, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('admin@sportsmed.com');
  const [password, setPassword] = useState('Admin@12345');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Set once login() reports mfaRequired — switches the form to the second-
  // factor step instead of submitting email/password again.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const result = await login(email, password);
        if (result.mfaRequired) setMfaToken(result.mfaToken);
      } else {
        await register({ email, password, name });
      }
    } catch (err: any) {
      setError(err?.serverMessage || err?.message || 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setSubmitting(true);
    try {
      await mfaChallenge(mfaToken, mfaCode);
    } catch (err: any) {
      setError(err?.serverMessage || err?.message || 'Invalid verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  if (mfaToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center">
              <KeyRound className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-100 tracking-tight uppercase">NEXUS Intelligence</h1>
              <p className="text-xs font-mono text-slate-500">Two-factor verification</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-100 mb-1">Enter verification code</h2>
            <p className="text-sm text-slate-400 mb-6">
              Enter the 6-digit code from your authenticator app, or one of your backup codes.
            </p>
            <form onSubmit={submitMfa} className="space-y-4">
              <Field icon={<KeyRound className="h-4 w-4" />} label="Verification code">
                <input
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500 tracking-widest text-center font-mono"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="123456"
                  autoFocus
                  required
                />
              </Field>

              {error && (
                <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-3 py-2">{error}</div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-colors"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify
              </button>
              <button
                type="button"
                className="w-full text-sm text-slate-500 hover:text-slate-300"
                onClick={() => { setMfaToken(null); setMfaCode(''); setError(null); }}
              >
                Back to sign in
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="h-12 w-12 rounded-2xl bg-indigo-600 flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-100 tracking-tight uppercase">NEXUS Intelligence</h1>
            <p className="text-xs font-mono text-slate-500">Anti-Doping &amp; Sports Medicine Core</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-slate-100 mb-1">
            {mode === 'login' ? 'Sign in' : 'Create an account'}
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            {mode === 'login' ? 'Access the secured intelligence console.' : 'Register a new analyst account.'}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <Field icon={<User className="h-4 w-4" />} label="Full name">
                <input
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Jane Analyst"
                  required
                />
              </Field>
            )}

            <Field icon={<Mail className="h-4 w-4" />} label="Email">
              <input
                type="email"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@agency.org"
                required
              />
            </Field>

            <Field icon={<Lock className="h-4 w-4" />} label="Password">
              <input
                type="password"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </Field>

            {error && (
              <div className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-xl px-3 py-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold rounded-xl px-4 py-2.5 flex items-center justify-center gap-2 transition-colors"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
            {mode === 'login' ? (
              <button className="hover:text-slate-300" onClick={() => { setMode('register'); setError(null); }}>
                Need an account? <span className="text-indigo-400 font-medium">Register</span>
              </button>
            ) : (
              <button className="hover:text-slate-300" onClick={() => { setMode('login'); setError(null); }}>
                Already registered? <span className="text-indigo-400 font-medium">Sign in</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6 font-mono">
          Demo credentials are pre-filled. Change them after first login.
        </p>
      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-1.5">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
