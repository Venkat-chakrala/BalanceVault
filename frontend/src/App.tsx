import React, { useState, useEffect } from 'react';
import {
  Vault,
  ArrowRightLeft,
  PlusCircle,
  ShieldCheck,
  FileCheck2,
  AlertCircle,
  Copy,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Receipt,
  ExternalLink,
} from 'lucide-react';
import { ApiClient } from './services/api';
import { Navbar } from './components/Navbar';
import { ProofModal } from './components/ProofModal';
import { TransferModal } from './components/TransferModal';
import { DepositModal } from './components/DepositModal';
import { AdminView } from './components/AdminView';

export function App() {
  const [user, setUser] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedProof, setSelectedProof] = useState<any>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'admin'>('dashboard');

  // Auth form states
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // KYC Submission state
  const [kycDocType, setKycDocType] = useState('Passport');
  const [kycDocNumber, setKycDocNumber] = useState('');
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [copiedAcc, setCopiedAcc] = useState<string | null>(null);

  // Check existing session
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await ApiClient.getMe();
        setUser(res.data.user);
        setAccounts(res.data.accounts);
        if (res.data.accounts[0]) {
          loadTransactions(res.data.accounts[0].id);
        }
      } catch {
        ApiClient.clearToken();
        setUser(null);
      }
    };
    initSession();
  }, []);

  const loadUserData = async () => {
    try {
      const res = await ApiClient.getMe();
      setUser(res.data.user);
      setAccounts(res.data.accounts);
      if (res.data.accounts[0]) {
        loadTransactions(res.data.accounts[0].id);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadTransactions = async (accId: string) => {
    try {
      const res = await ApiClient.getAccountTransactions(accId);
      setTransactions(res.data);
    } catch (err: any) {
      console.error('Failed to load transactions', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const res = await ApiClient.login({ email: authEmail, password: authPassword });
      ApiClient.setToken(res.data.token);
      setUser(res.data.user);
      setAccounts(res.data.accounts);
      if (res.data.accounts[0]) {
        loadTransactions(res.data.accounts[0].id);
      }
      if (res.data.user.role === 'ADMIN' || res.data.user.role === 'AUDITOR') {
        setActiveTab('admin');
      } else {
        setActiveTab('dashboard');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      const res = await ApiClient.register({
        email: authEmail,
        password: authPassword,
        fullName: authFullName,
        initialDepositCents: 100000, // Pre-fund test account with $1,000 for demonstration!
      });
      ApiClient.setToken(res.data.token);
      setUser(res.data.user);
      setAccounts([res.data.account]);
      loadUserData();
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleQuickLogin = async (email: string, pass: string) => {
    setAuthError(null);
    setAuthEmail(email);
    setAuthPassword(pass);
    setAuthLoading(true);
    try {
      const res = await ApiClient.login({ email, password: pass });
      ApiClient.setToken(res.data.token);
      setUser(res.data.user);
      setAccounts(res.data.accounts);
      if (res.data.accounts[0]) {
        loadTransactions(res.data.accounts[0].id);
      }
      if (res.data.user.role === 'ADMIN' || res.data.user.role === 'AUDITOR') {
        setActiveTab('admin');
      } else {
        setActiveTab('dashboard');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    ApiClient.clearToken();
    setUser(null);
    setAccounts([]);
    setTransactions([]);
    setActiveTab('dashboard');
  };

  const handleViewProof = async (reference: string) => {
    try {
      const res = await ApiClient.getProof(reference);
      setSelectedProof(res.data);
    } catch (err: any) {
      alert(`Failed to load cryptographic proof: ${err.message}`);
    }
  };

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycDocNumber.trim()) return;
    try {
      setKycSubmitting(true);
      await ApiClient.submitKyc({ documentType: kycDocType, documentNumber: kycDocNumber });
      loadUserData();
    } catch (err: any) {
      alert(`KYC submission failed: ${err.message}`);
    } finally {
      setKycSubmitting(false);
    }
  };

  const copyAccount = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAcc(text);
    setTimeout(() => setCopiedAcc(null), 2000);
  };

  const primaryAccount = accounts[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        currentUser={user}
        onLogout={handleLogout}
        onQuickLogin={handleQuickLogin}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!user ? (
          /* Authentication Screen */
          <div className="max-w-md mx-auto my-12 animate-in fade-in duration-300">
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Vault className="w-7 h-7 text-slate-950 stroke-[2.5]" />
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {isLoginMode ? 'Sign in to BalanceVault' : 'Open Account Vault'}
                </h2>
                <p className="text-xs text-slate-400">
                  {isLoginMode
                    ? 'Provable ledger with server-enforced role access'
                    : 'Get started with an auto-provisioned checking account'}
                </p>
              </div>

              {authError && (
                <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={isLoginMode ? handleLogin : handleRegister} className="space-y-4">
                {!isLoginMode && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="you@domain.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Account Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center justify-center gap-2"
                >
                  {authLoading ? 'Verifying...' : isLoginMode ? 'Sign In' : 'Create Account Vault'}
                </button>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginMode(!isLoginMode);
                    setAuthError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-emerald-400 transition"
                >
                  {isLoginMode ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'admin' ? (
          /* Admin / Auditor View */
          <AdminView currentUserRole={user.role} />
        ) : (
          /* User Dashboard */
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* KYC Onboarding Notice if not approved */}
            {user.kycStatus !== 'APPROVED' && (
              <div className="p-5 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Identity Onboarding Verification Required
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                        STATUS: {user.kycStatus}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Submit your verification credentials to unlock compliance certification.
                    </p>
                  </div>
                </div>

                {user.kycStatus === 'UNSUBMITTED' ? (
                  <form onSubmit={handleKycSubmit} className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={kycDocType}
                      onChange={(e) => setKycDocType(e.target.value)}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
                    >
                      <option value="Passport">Passport</option>
                      <option value="Drivers License">Driver's License</option>
                      <option value="National ID">National ID</option>
                    </select>
                    <input
                      type="text"
                      required
                      placeholder="Document ID #"
                      value={kycDocNumber}
                      onChange={(e) => setKycDocNumber(e.target.value)}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={kycSubmitting}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition"
                    >
                      {kycSubmitting ? '...' : 'Submit'}
                    </button>
                  </form>
                ) : (
                  <span className="text-xs font-mono text-amber-400 font-semibold">
                    Documents submitted — pending compliance approval
                  </span>
                )}
              </div>
            )}

            {/* Account Overview Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Primary Balance Card */}
              <div className="lg:col-span-2 p-6 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-0 pointer-events-none" />

                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
                      Available Checking Balance
                    </span>
                    <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight flex items-baseline gap-2">
                      {primaryAccount ? primaryAccount.cachedBalanceFormatted : '$0.00'}
                      <span className="text-xs text-emerald-400 font-bold font-sans px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        USD
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowTransferModal(true)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center gap-2"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Send Money
                    </button>
                    <button
                      onClick={() => setShowDepositModal(true)}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition flex items-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4 text-emerald-400" />
                      Deposit Funds
                    </button>
                  </div>
                </div>

                {/* Account Details Footer */}
                {primaryAccount && (
                  <div className="relative z-10 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 block">Account Number</span>
                      <span className="text-slate-200 font-bold flex items-center gap-1.5 mt-0.5">
                        {primaryAccount.accountNumber}
                        <button
                          onClick={() => copyAccount(primaryAccount.accountNumber)}
                          className="text-slate-500 hover:text-white"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block">Account UUID (For Transfers)</span>
                      <span className="text-slate-300 truncate block mt-0.5" title={primaryAccount.id}>
                        {primaryAccount.id.slice(0, 16)}...
                        <button
                          onClick={() => copyAccount(primaryAccount.id)}
                          className="inline ml-1 text-emerald-400 hover:text-emerald-300"
                        >
                          {copiedAcc === primaryAccount.id ? 'Copied' : 'Copy'}
                        </button>
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block">Ledger State</span>
                      <span className="text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Double-Entry Verified
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Cryptographic Ledger Summary Card */}
              <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="p-2.5 w-fit bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">Provable Ledger Guarantee</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Unlike standard databases that store mutable balances, BalanceVault binds every financial
                    event into a double-entry journal and an immutable SHA-256 block chain.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>Accounting Standard:</span>
                    <span className="text-slate-200 font-semibold">Strict Double-Entry</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Tamper Detection:</span>
                    <span className="text-emerald-400 font-semibold">SHA-256 Chained</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Race Protection:</span>
                    <span className="text-indigo-400 font-semibold">ACID Serializable</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Transaction Ledger */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Transaction Ledger History</h3>
                  <p className="text-xs text-slate-400">
                    Chronological double-entry transactions anchored with cryptographic proof receipts
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500">{transactions.length} entries</span>
              </div>

              {transactions.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs">
                  No transactions recorded yet. Click "Send Money" or "Deposit Funds" above!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="p-4">Time</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Description</th>
                        <th className="p-4">Counterparty</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Balance After</th>
                        <th className="p-4 text-right">Cryptographic Proof</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {transactions.map((tx) => (
                        <tr key={tx.entryId} className="hover:bg-slate-800/30 transition">
                          <td className="p-4 text-slate-400 whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit ${
                                tx.entryType === 'CREDIT'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {tx.entryType === 'CREDIT' ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {tx.entryType}
                            </span>
                          </td>
                          <td className="p-4 text-slate-200 font-sans">{tx.description}</td>
                          <td className="p-4 text-slate-400">{tx.counterpartyAccount}</td>
                          <td
                            className={`p-4 font-bold ${
                              tx.entryType === 'CREDIT' ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {tx.entryType === 'CREDIT' ? '+' : '-'}
                            {tx.amountFormatted}
                          </td>
                          <td className="p-4 text-slate-300 font-semibold">{tx.balanceAfterFormatted}</td>
                          <td className="p-4 text-right font-sans">
                            <button
                              onClick={() => handleViewProof(tx.reference)}
                              className="px-3 py-1.5 text-[11px] font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-500/30 transition inline-flex items-center gap-1.5"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              View Proof
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showTransferModal && (
        <TransferModal
          accounts={accounts}
          onClose={() => setShowTransferModal(false)}
          onSuccess={loadUserData}
        />
      )}

      {showDepositModal && (
        <DepositModal
          accounts={accounts}
          onClose={() => setShowDepositModal(false)}
          onSuccess={loadUserData}
        />
      )}

      {selectedProof && (
        <ProofModal proof={selectedProof} onClose={() => setSelectedProof(null)} />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>BalanceVault — Money movement with a ledger you can prove • Snovasys Hiring Challenge 2026</p>
      </footer>
    </div>
  );
}

export default App;
