import React, { useEffect, useRef, useState } from 'react';
import {
  Menu,
  UserCheck,
  LogOut,
  ChevronDown,
  Shield,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { ApiClient } from '../services/api';

interface NavbarProps {
  currentUser: {
    id: string;
    fullName: string;
    email: string;
    role: 'USER' | 'ADMIN' | 'AUDITOR';
  };
  pageTitle: string;
  onOpenMobileMenu: () => void;
  onNavigateProfile: () => void;
  onRequestLogout: () => void;
}

function getInitials(name: string): string {
  const parts = (name || 'U').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  pageTitle,
  onOpenMobileMenu,
  onNavigateProfile,
  onRequestLogout,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [systemOnline, setSystemOnline] = useState<boolean | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      try {
        await ApiClient.getReady();
        if (mounted) setSystemOnline(true);
      } catch {
        if (mounted) setSystemOnline(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 20000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const roleBadgeClass =
    currentUser.role === 'ADMIN'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      : currentUser.role === 'AUDITOR'
      ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left: Mobile Sidebar Toggle + Page Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base sm:text-lg font-semibold text-white truncate">{pageTitle}</h1>
      </div>

      {/* Right: Backend Readiness Status + User Profile Dropdown */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Live Server Status */}
        <div
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs"
          title="Backend Database & Ledger Readiness"
        >
          {systemOnline === false ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-400 font-medium">Offline</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300 font-medium">
                {systemOnline === null ? 'Connecting...' : 'Ledger Online'}
              </span>
            </>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 transition text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/80 to-indigo-600/80 border border-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {getInitials(currentUser.fullName)}
            </div>
            <div className="hidden md:block leading-tight">
              <div className="text-xs font-semibold text-white max-w-[140px] truncate">
                {currentUser.fullName}
              </div>
              <div className="text-[10px] font-mono text-slate-400">{currentUser.role}</div>
            </div>
            <span
              className={`md:hidden px-1.5 py-0.5 rounded text-[10px] font-mono border ${roleBadgeClass}`}
            >
              {currentUser.role}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 overflow-hidden z-50"
            >
              <div className="px-4 py-3 border-b border-slate-800 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white truncate">
                    {currentUser.fullName}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border shrink-0 ${roleBadgeClass}`}
                  >
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-xs text-slate-400 truncate">{currentUser.email}</div>
              </div>

              <div className="p-1.5 space-y-0.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDropdownOpen(false);
                    onNavigateProfile();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <UserCheck className="w-4 h-4 text-emerald-400" />
                  <span>Profile &amp; Security</span>
                </button>

                <div className="my-1 border-t border-slate-800" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDropdownOpen(false);
                    onRequestLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
              <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800 flex items-center gap-1.5 text-[10px] text-slate-500">
                <Shield className="w-3 h-3 text-emerald-500" />
                <span>Session protected by live JWT check</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
