import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { ApiClient } from '../services/api';

interface AuthPageProps {
  initialNotice?: string | null;
  onAuthenticated: (data: any) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthPage: React.FC<AuthPageProps> = ({ initialNotice, onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean; fullName?: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; isSuspended?: boolean } | null>(null);

  const emailError =
    touched.email && !EMAIL_REGEX.test(email.trim())
      ? 'Enter a valid email address (e.g. name@domain.com).'
      : null;

  const hasMinLen = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);

  const passwordError = (() => {
    if (!touched.password) return null;
    if (!password) return 'Password is required.';
    if (mode === 'register' && (!hasMinLen || !hasUpper || !hasDigit)) {
      return 'Password must be at least 8 characters and include 1 uppercase letter and 1 number.';
    }
    return null;
  })();

  const fullNameError =
    mode === 'register' && touched.fullName && fullName.trim().length < 2
      ? 'Full name must be at least 2 characters.'
      : null;

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError(null);
    setTouched({});
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTouched({ email: true, password: true, fullName: mode === 'register' });

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return;
    }
    if (!password) {
      return;
    }
    if (mode === 'register') {
      if (fullName.trim().length < 2 || !hasMinLen || !hasUpper || !hasDigit) {
        return;
      }
    }

    try {
      setLoading(true);
      if (mode === 'login') {
        const res = await ApiClient.login({ email: cleanEmail, password });
        ApiClient.setToken(res.data.token);
        onAuthenticated(res.data);
      } else {
        const res = await ApiClient.register({
          email: cleanEmail,
          password,
          fullName: fullName.trim(),
          phone: phone.trim() || undefined,
        });
        ApiClient.setToken(res.data.token);
        onAuthenticated(res.data);
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please check your credentials.';
      const isSuspended =
        err?.code === 'ACCOUNT_SUSPENDED' || msg.toLowerCase().includes('suspended');
      setError({ message: msg, isSuspended });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20 mb-1">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">BalanceVault</h1>
          <p className="text-sm text-slate-400">
            Cryptographic Double-Entry Financial Ledger
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-900/60">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-3.5 text-sm font-semibold transition border-b-2 ${
                mode === 'login'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-3.5 text-sm font-semibold transition border-b-2 ${
                mode === 'register'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="p-6 sm:p-7 space-y-4">
            {initialNotice && !error && (
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/25 rounded-xl text-indigo-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{initialNotice}</span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border ${
                  error.isSuspended
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-red-500/10 border-red-500/25 text-red-400'
                }`}
              >
                {error.isSuspended ? (
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  {error.isSuspended && (
                    <div className="font-semibold text-amber-200">Account Suspended</div>
                  )}
                  <div>{error.message}</div>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <>
                <div>
                  <label htmlFor="auth-fullname" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      id="auth-fullname"
                      type="text"
                      autoComplete="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onBlur={() => setTouched((prev) => ({ ...prev, fullName: true }))}
                      placeholder="Alex Rivera"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                  {fullNameError && <p className="mt-1 text-xs text-red-400">{fullNameError}</p>}
                </div>

                <div>
                  <label htmlFor="auth-phone" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Phone Number <span className="text-slate-500">(optional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      id="auth-phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 234-5678"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
              {emailError && <p className="mt-1 text-xs text-red-400">{emailError}</p>}
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-2 p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/70 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && <p className="mt-1 text-xs text-red-400">{passwordError}</p>}

              {mode === 'register' && (
                <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[11px]">
                  <span className={`flex items-center gap-1 ${hasMinLen ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <CheckCircle2 className="w-3 h-3 shrink-0" /> 8+ chars
                  </span>
                  <span className={`flex items-center gap-1 ${hasUpper ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <CheckCircle2 className="w-3 h-3 shrink-0" /> Uppercase
                  </span>
                  <span className={`flex items-center gap-1 ${hasDigit ? 'text-emerald-400' : 'text-slate-500'}`}>
                    <CheckCircle2 className="w-3 h-3 shrink-0" /> Number
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-950/50 transition flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{mode === 'login' ? 'Verifying session...' : 'Creating vault...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In to Vault' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Assurance Footer */}
        <p className="text-center text-xs text-slate-500">
          Protected by server-enforced RBAC, SHA-256 hash chaining, and live JWT revocation.
        </p>
      </div>
    </div>
  );
};
