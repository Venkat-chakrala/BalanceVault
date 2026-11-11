import React from 'react';
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  History,
  ShieldCheck,
  FileSearch,
  Users,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

export type RouteView =
  | 'dashboard'
  | 'accounts'
  | 'transfers'
  | 'transactions'
  | 'admin'
  | 'ledger'
  | 'audit'
  | 'profile';

interface NavItem {
  id: RouteView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<'USER' | 'ADMIN' | 'AUDITOR'>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, roles: ['USER', 'AUDITOR'] },
  { id: 'admin', label: 'Admin Portal', icon: Users, roles: ['ADMIN'] },
  { id: 'ledger', label: 'Ledger Verification', icon: ShieldCheck, roles: ['ADMIN', 'AUDITOR'] },
  { id: 'audit', label: 'Audit Trail', icon: FileSearch, roles: ['ADMIN', 'AUDITOR'] },
  { id: 'accounts', label: 'Accounts', icon: Landmark, roles: ['USER', 'ADMIN', 'AUDITOR'] },
  { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight, roles: ['USER', 'ADMIN', 'AUDITOR'] },
  { id: 'transactions', label: 'Transaction History', icon: History, roles: ['USER', 'ADMIN', 'AUDITOR'] },
  { id: 'profile', label: 'Profile & Security', icon: UserCheck, roles: ['USER', 'ADMIN', 'AUDITOR'] },
];

interface SidebarProps {
  activeView: RouteView;
  userRole: 'USER' | 'ADMIN' | 'AUDITOR';
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onNavigate: (view: RouteView) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  userRole,
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onCloseMobile,
  onNavigate,
}) => {
  const allowedItems = NAV_ITEMS.filter((item) => item.roles.includes(userRole));

  const renderLinks = (isCollapsed: boolean) => (
    <nav aria-label="Primary Sidebar" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {allowedItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onNavigate(item.id);
              onCloseMobile();
            }}
            title={isCollapsed ? item.label : undefined}
            aria-current={isActive ? 'page' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition relative ${
              isActive
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
          >
            {isActive && !isCollapsed && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-emerald-400" />
            )}
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
            {!isCollapsed && <span className="truncate">{item.label}</span>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-slate-900 border-r border-slate-800 transition-all duration-200 ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div
          className={`h-16 flex items-center border-b border-slate-800 px-4 ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white tracking-tight truncate">BalanceVault</div>
                <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider truncate">
                  {userRole} Portal
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {renderLinks(collapsed)}

        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 text-center">
          {collapsed ? 'SHA256' : 'Immutable SHA-256 Ledger'}
        </div>
      </aside>

      {/* Mobile / Tablet Slide-over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[80vw] bg-slate-900 border-r border-slate-800 flex flex-col h-full shadow-2xl">
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">BalanceVault</div>
                  <div className="text-[10px] font-mono text-emerald-400 uppercase">{userRole} Portal</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close menu"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderLinks(false)}
          </aside>
        </div>
      )}
    </>
  );
};
