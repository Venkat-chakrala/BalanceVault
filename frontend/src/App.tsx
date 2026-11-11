import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { ApiClient } from './services/api';
import { AuthPage } from './components/AuthPage';
import { Navbar } from './components/Navbar';
import { Sidebar, type RouteView } from './components/Sidebar';
import { LogoutModal } from './components/LogoutModal';
import { AdminView } from './components/AdminView';
import { ProofModal } from './components/ProofModal';
import { TransferModal } from './components/TransferModal';
import { DepositModal } from './components/DepositModal';
import {
  OverviewView,
  AccountsView,
  TransfersView,
  TransactionsView,
  ProfileView,
  type AccountItem,
  type TransactionEntryItem,
} from './components/DashboardViews';

const PATH_TO_VIEW: Record<string, RouteView> = {
  '/dashboard': 'dashboard',
  '/accounts': 'accounts',
  '/transfers': 'transfers',
  '/transactions': 'transactions',
  '/admin': 'admin',
  '/ledger': 'ledger',
  '/audit': 'audit',
  '/profile': 'profile',
};

const VIEW_TITLE: Record<RouteView, string> = {
  dashboard: 'Account Overview',
  accounts: 'Vault Accounts',
  transfers: 'Money Transfers',
  transactions: 'Transaction History',
  admin: 'Administrator Portal',
  ledger: 'Cryptographic Ledger Verification',
  audit: 'Security Audit Trail',
  profile: 'Profile & Compliance',
};

function getDefaultViewForRole(role: string): RouteView {
  if (role === 'ADMIN') return 'admin';
  if (role === 'AUDITOR') return 'ledger';
  return 'dashboard';
}

function isViewAllowedForRole(view: RouteView, role: string): boolean {
  if (view === 'admin') return role === 'ADMIN';
  if (view === 'ledger' || view === 'audit') return role === 'ADMIN' || role === 'AUDITOR';
  if (view === 'dashboard') return role === 'USER' || role === 'AUDITOR';
  return true;
}

export function App() {
  const [user, setUser] = useState<any>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [transactions, setTransactions] = useState<TransactionEntryItem[]>([]);

  const [initializingAuth, setInitializingAuth] = useState<boolean>(Boolean(ApiClient.getToken()));
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<RouteView>('dashboard');
  const [routeNotice, setRouteNotice] = useState<string | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [loadingTx, setLoadingTx] = useState(false);
  const [errorTx, setErrorTx] = useState<string | null>(null);

  const [selectedProof, setSelectedProof] = useState<any>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navigateTo = useCallback(
    (targetView: RouteView, replace = false) => {
      if (!user) return;
      if (!isViewAllowedForRole(targetView, user.role)) {
        const fallback = getDefaultViewForRole(user.role);
        setRouteNotice(
          `Access restricted: Your ${user.role} role does not have permission for that page.`
        );
        setActiveView(fallback);
        window.history.replaceState(null, '', `/${fallback}`);
        return;
      }
      setRouteNotice(null);
      setActiveView(targetView);
      const targetPath = `/${targetView}`;
      if (window.location.pathname !== targetPath) {
        if (replace) window.history.replaceState(null, '', targetPath);
        else window.history.pushState(null, '', targetPath);
      }
    },
    [user]
  );

  const clearAuthenticatedState = useCallback((notice?: string) => {
    ApiClient.clearToken();
    setUser(null);
    setAccounts([]);
    setSelectedAccountId('');
    setTransactions([]);
    setSelectedProof(null);
    setShowTransferModal(false);
    setShowDepositModal(false);
    setShowLogoutModal(false);
    setRouteNotice(null);
    if (notice) setAuthNotice(notice);
    if (window.location.pathname !== '/login') {
      window.history.replaceState(null, '', '/login');
    }
  }, []);

  const loadTransactions = useCallback(async (accId: string) => {
    if (!accId) {
      setTransactions([]);
      return;
    }
    try {
      setLoadingTx(true);
      setErrorTx(null);
      const res = await ApiClient.getAccountTransactions(accId);
      setTransactions(res.data || []);
    } catch (err: any) {
      setErrorTx(err.message || 'Failed to load account ledger entries.');
    } finally {
      setLoadingTx(false);
    }
  }, []);

  const refreshProfileAndAccounts = useCallback(async () => {
    const res = await ApiClient.getMe();
    const fetchedUser = res.data.user;
    const fetchedAccounts: AccountItem[] = res.data.accounts || [];
    setUser(fetchedUser);
    setAccounts(fetchedAccounts);

    setSelectedAccountId((prevId) => {
      const stillExists = fetchedAccounts.some((a) => a.id === prevId);
      const nextId = stillExists ? prevId : fetchedAccounts[0]?.id || '';
      if (nextId) {
        loadTransactions(nextId);
      } else {
        setTransactions([]);
      }
      return nextId;
    });

    return fetchedUser;
  }, [loadTransactions]);

  // Initial session validation on load / page refresh
  useEffect(() => {
    const bootstrap = async () => {
      const token = ApiClient.getToken();
      if (!token) {
        if (window.location.pathname !== '/login') {
          window.history.replaceState(null, '', '/login');
        }
        setInitializingAuth(false);
        return;
      }

      try {
        const fetchedUser = await refreshProfileAndAccounts();
        const requestedView = PATH_TO_VIEW[window.location.pathname];
        const initialView =
          requestedView && isViewAllowedForRole(requestedView, fetchedUser.role)
            ? requestedView
            : getDefaultViewForRole(fetchedUser.role);
        setActiveView(initialView);
        window.history.replaceState(null, '', `/${initialView}`);
      } catch (err: any) {
        clearAuthenticatedState(
          err?.message || 'Your previous session expired or was revoked. Please sign in again.'
        );
      } finally {
        setInitializingAuth(false);
      }
    };
    bootstrap();
  }, [refreshProfileAndAccounts, clearAuthenticatedState]);

  // Listen for session revocation events emitted by ApiClient (401/403 suspension)
  useEffect(() => {
    const handleRevoked = (e: Event) => {
      const custom = e as CustomEvent<{ message?: string }>;
      clearAuthenticatedState(custom.detail?.message || 'Session ended. Please sign in again.');
    };
    window.addEventListener('bv:session-revoked', handleRevoked);
    return () => window.removeEventListener('bv:session-revoked', handleRevoked);
  }, [clearAuthenticatedState]);

  // Guard browser Back/Forward navigation cleanly
  useEffect(() => {
    const handlePopState = () => {
      if (!ApiClient.getToken() || !user) {
        if (window.location.pathname !== '/login') {
          window.history.replaceState(null, '', '/login');
        }
        return;
      }
      const view = PATH_TO_VIEW[window.location.pathname];
      if (!view || !isViewAllowedForRole(view, user.role)) {
        const fallback = getDefaultViewForRole(user.role);
        setActiveView(fallback);
        window.history.replaceState(null, '', `/${fallback}`);
      } else {
        setActiveView(view);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  // Fetch transactions whenever user switches active account
  const handleSelectAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    loadTransactions(accountId);
  };

  const handleAuthenticated = async (authPayload: any) => {
    setAuthNotice(null);
    setRouteNotice(null);
    try {
      const verifiedUser = await refreshProfileAndAccounts();
      const landing = getDefaultViewForRole(verifiedUser.role);
      setActiveView(landing);
      window.history.replaceState(null, '', `/${landing}`);
    } catch {
      const fallbackUser = authPayload.user;
      setUser(fallbackUser);
      const landing = getDefaultViewForRole(fallbackUser.role);
      setActiveView(landing);
      window.history.replaceState(null, '', `/${landing}`);
    }
  };

  const handleConfirmLogout = async () => {
    try {
      setLoggingOut(true);
      await ApiClient.logout();
    } catch {
      // Token cleared client-side in ApiClient.logout() finally block regardless
    } finally {
      setLoggingOut(false);
      clearAuthenticatedState('You have been securely signed out.');
    }
  };

  const handleViewProof = async (reference: string) => {
    try {
      setProofError(null);
      const res = await ApiClient.getProof(reference);
      setSelectedProof(res.data);
    } catch (err: any) {
      setProofError(err.message || 'Unable to load cryptographic proof.');
    }
  };

  if (initializingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-xs font-mono text-slate-400">Validating encrypted vault session...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage initialNotice={authNotice} onAuthenticated={handleAuthenticated} />;
  }

  const renderMainContent = () => {
    if (activeView === 'admin' && user.role === 'ADMIN') {
      return (
        <AdminView
          currentUserRole={user.role}
          section="overview"
          onNavigate={(v) => navigateTo(v)}
        />
      );
    }

    if (activeView === 'ledger' && (user.role === 'ADMIN' || user.role === 'AUDITOR')) {
      return <AdminView currentUserRole={user.role} section="ledger" />;
    }

    if (activeView === 'audit' && (user.role === 'ADMIN' || user.role === 'AUDITOR')) {
      return <AdminView currentUserRole={user.role} section="audit" />;
    }

    if (activeView === 'accounts') {
      return (
        <AccountsView
          accounts={accounts}
          onSelectAccountAndViewTx={(id) => {
            handleSelectAccount(id);
            navigateTo('transactions');
          }}
          onSelectAccountAndTransfer={(id) => {
            handleSelectAccount(id);
            setShowTransferModal(true);
          }}
          onAccountCreated={async () => {
            await refreshProfileAndAccounts();
          }}
        />
      );
    }

    if (activeView === 'transfers') {
      return (
        <TransfersView
          accounts={accounts}
          transactions={transactions}
          loadingTx={loadingTx}
          onOpenTransfer={() => setShowTransferModal(true)}
          onOpenDeposit={() => setShowDepositModal(true)}
          onViewProof={handleViewProof}
        />
      );
    }

    if (activeView === 'transactions') {
      return (
        <TransactionsView
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={handleSelectAccount}
          transactions={transactions}
          loadingTx={loadingTx}
          errorTx={errorTx}
          onRefresh={() => loadTransactions(selectedAccountId)}
          onViewProof={handleViewProof}
        />
      );
    }

    if (activeView === 'profile') {
      return (
        <ProfileView
          user={user}
          onProfileUpdated={async () => {
            await refreshProfileAndAccounts();
          }}
          onRequestLogout={() => setShowLogoutModal(true)}
        />
      );
    }

    return (
      <OverviewView
        user={user}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={handleSelectAccount}
        transactions={transactions}
        loadingTx={loadingTx}
        errorTx={errorTx}
        onRefresh={() => {
          refreshProfileAndAccounts();
        }}
        onNavigate={(view) => navigateTo(view)}
        onOpenTransfer={() => setShowTransferModal(true)}
        onOpenDeposit={() => setShowDepositModal(true)}
        onViewProof={handleViewProof}
      />
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar
        activeView={activeView}
        userRole={user.role}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onNavigate={(view) => navigateTo(view)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          currentUser={user}
          pageTitle={VIEW_TITLE[activeView]}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNavigateProfile={() => navigateTo('profile')}
          onRequestLogout={() => setShowLogoutModal(true)}
        />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto space-y-5">
          {routeNotice && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{routeNotice}</span>
            </div>
          )}

          {proofError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{proofError}</span>
            </div>
          )}

          {renderMainContent()}
        </main>
      </div>

      {/* Modals */}
      {showTransferModal && (
        <TransferModal
          accounts={accounts}
          defaultFromAccountId={selectedAccountId}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => {
            refreshProfileAndAccounts();
          }}
        />
      )}

      {showDepositModal && (
        <DepositModal
          accounts={accounts}
          onClose={() => setShowDepositModal(false)}
          onSuccess={() => {
            refreshProfileAndAccounts();
          }}
        />
      )}

      {selectedProof && (
        <ProofModal proof={selectedProof} onClose={() => setSelectedProof(null)} />
      )}

      <LogoutModal
        isOpen={showLogoutModal}
        userName={user.fullName}
        userRole={user.role}
        loading={loggingOut}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
      />
    </div>
  );
}

export default App;
