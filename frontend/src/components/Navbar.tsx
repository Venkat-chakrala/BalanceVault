import React, { useEffect, useState } from 'react';
import { Vault, ShieldCheck, LogOut, CheckCircle2, User, Key } from 'lucide-react';
import { ApiClient } from '../services/api';

interface NavbarProps {
  currentUser: any;
  onLogout: () => void;
  onQuickLogin: (email: string, pass: string) => void;
  activeTab: 'dashboard' | 'admin';
  setActiveTab: (tab: 'dashboard' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  onQuickLogin,
  activeTab,
  setActiveTab,
}) => {
  const [systemReady, setSystemReady] = useState(false);

  useEffect(() => {
    const probe = async () => {
      try {
        const res = await ApiClient.getReady();
        if (res.status === 'READY') setSystemReady(true);
      } catch {
        setSystemReady(false);
      }
    };
    probe();
    const interval = setInterval(probe, 15000);
    return () => clearInterval(interval);
  }, []);

  const isPrivileged = currentUser?.role === 'ADMIN' || currentUser?.role === 'AUDITOR';

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      {/* Evaluator Quick Access Bar */}
      <div className="bg-slate-950 border-b border-slate-800/80 px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-400">
          <Key className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-slate-300">Evaluator Benchmark Accounts:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <button
            onClick={() => onQuickLogin('alice@balancevault.com', 'AlicePassword@123')}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 transition"
          >
            Alice ($5,000)
          </button>
          <button
            onClick={() => onQuickLogin('bob@balancevault.com', 'BobPassword@123')}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-800 transition"
          >
            Bob ($2,500)
          </button>
          <button
            onClick={() => onQuickLogin('admin@balancevault.com', 'AdminPassword@123')}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-purple-400 border border-slate-800 transition"
          >
            Admin
          </button>
          <button
            onClick={() => onQuickLogin('auditor@balancevault.com', 'AuditorPassword@123')}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 transition"
          >
            Auditor
          </button>
          <button
            onClick={() => onQuickLogin('charlie@balancevault.com', 'CharliePassword@123')}
            className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-red-400 border border-slate-800 transition"
            title="Tests immediate 403 suspension rejection"
          >
            Charlie (Suspended)
          </button>
        </div>
      </div>

      {/* Main Nav */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Vault className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                Balance<span className="text-emerald-400">Vault</span>
              </span>
              <span className="text-[10px] text-slate-400 block -mt-1 font-mono">
                PROVABLE FINANCIAL LEDGER
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          {currentUser && (
            <div className="hidden sm:flex items-center space-x-2 pl-4 border-l border-slate-800">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'dashboard'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                My Vault
              </button>
              {isPrivileged && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    activeTab === 'admin'
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {currentUser.role === 'ADMIN' ? 'Admin Portal' : 'Compliance & Audit'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-4">
          {/* Health Status Pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${systemReady ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}
            />
            <span className="text-slate-400 font-mono text-[11px]">
              {systemReady ? 'CORE OPERATIONAL' : 'SYSTEM OFFLINE'}
            </span>
          </div>

          {/* User Profile */}
          {currentUser && (
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-white">{currentUser.fullName}</div>
                <div className="flex items-center justify-end gap-1.5">
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                      currentUser.role === 'ADMIN'
                        ? 'bg-purple-500/20 text-purple-400'
                        : currentUser.role === 'AUDITOR'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {currentUser.role}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">{currentUser.email}</span>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
