import React, { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  Users,
  Activity,
  FileSearch,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  Loader2,
  X,
  UserCheck,
  UserX,
  Hash,
} from 'lucide-react';
import { ApiClient } from '../services/api';

interface AdminViewProps {
  currentUserRole: 'USER' | 'ADMIN' | 'AUDITOR';
  section?: 'overview' | 'ledger' | 'audit';
  onNavigate?: (view: 'admin' | 'ledger' | 'audit') => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  currentUserRole,
  section = 'overview',
  onNavigate,
}) => {
  const isAdmin = currentUserRole === 'ADMIN';

  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const [banner, setBanner] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'ALL' | 'USER' | 'ADMIN' | 'AUDITOR'>('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  const [auditSearch, setAuditSearch] = useState('');
  const [auditSeverity, setAuditSeverity] = useState<string>('ALL');
  const [auditPage, setAuditPage] = useState(0);
  const AUDIT_LIMIT = 25;

  const fetchAuditLogs = useCallback(
    async (opts?: { search?: string; severity?: string; page?: number }) => {
      try {
        setLoadingAudit(true);
        const targetPage = opts?.page ?? auditPage;
        const targetSeverity = opts?.severity ?? auditSeverity;
        const targetSearch = opts?.search ?? auditSearch;

        const res = await ApiClient.getAuditTrail({
          limit: AUDIT_LIMIT,
          offset: targetPage * AUDIT_LIMIT,
          severity: targetSeverity !== 'ALL' ? targetSeverity : undefined,
          search: targetSearch.trim() || undefined,
        });

        setAuditLogs(res.data?.logs || []);
        setAuditTotal(res.data?.total || 0);
      } catch (err: any) {
        setBanner({ type: 'error', message: err.message || 'Failed to load audit trail.' });
      } finally {
        setLoadingAudit(false);
      }
    },
    [auditPage, auditSeverity, auditSearch]
  );

  const loadData = useCallback(async () => {
    try {
      setLoadingInitial(true);
      const promises: Promise<any>[] = [
        ApiClient.getStats(),
        ApiClient.getAuditTrail({
          limit: AUDIT_LIMIT,
          offset: 0,
        }),
      ];

      if (isAdmin) {
        promises.push(ApiClient.getUsers());
      }

      const [statsRes, auditRes, usersRes] = await Promise.all(promises);
      setStats(statsRes.data);
      setAuditLogs(auditRes.data?.logs || []);
      setAuditTotal(auditRes.data?.total || 0);
      if (isAdmin && usersRes) {
        setUsers(usersRes.data?.users || []);
      }
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Failed to load portal data.' });
    } finally {
      setLoadingInitial(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Run verification automatically when landing directly on Ledger Verification section
  const handleVerifyLedger = useCallback(async () => {
    try {
      setVerifying(true);
      setBanner(null);
      const res = await ApiClient.verifyLedger();
      setVerificationResult(res.data);
      await fetchAuditLogs({ page: 0 });
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Ledger verification failed.' });
    } finally {
      setVerifying(false);
    }
  }, [fetchAuditLogs]);

  useEffect(() => {
    if (section === 'ledger' && !verificationResult) {
      handleVerifyLedger();
    }
  }, [section, verificationResult, handleVerifyLedger]);

  const handleToggleUserStatus = async (userId: string, currentStatus: string, email: string) => {
    const newStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    try {
      setUpdatingUserId(userId);
      setBanner(null);
      await ApiClient.updateUser(userId, { status: newStatus });
      setBanner({
        type: 'success',
        message:
          newStatus === 'SUSPENDED'
            ? `Suspended ${email} and invalidated all active JWT tokens.`
            : `Reactivated ${email} and unfroze linked accounts.`,
      });
      await loadData();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Unable to update user status.' });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleApproveKyc = async (userId: string, email: string) => {
    try {
      setUpdatingUserId(userId);
      setBanner(null);
      await ApiClient.updateUser(userId, { kycStatus: 'APPROVED' });
      setBanner({ type: 'success', message: `KYC approved for ${email}.` });
      await loadData();
    } catch (err: any) {
      setBanner({ type: 'error', message: err.message || 'Unable to update KYC status.' });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleAuditFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuditPage(0);
    fetchAuditLogs({ search: auditSearch, severity: auditSeverity, page: 0 });
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !userSearch.trim() ||
      u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.accounts?.some((a: any) =>
        a.accountNumber.toLowerCase().includes(userSearch.toLowerCase())
      );
    const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
    const matchesStatus = userStatusFilter === 'ALL' || u.status === userStatusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loadingInitial && !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
        <span className="text-sm">Loading compliance &amp; telemetry data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {banner && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            banner.type === 'error'
              ? 'bg-red-500/10 border-red-500/25 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBanner(null)}
            aria-label="Dismiss notification"
            className="p-1 hover:bg-white/5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Telemetry KPI Grid */}
      {stats && (section === 'overview' || section === 'ledger') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Total Vault Liquidity</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {stats.totalVaultBalanceFormatted}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Across {stats.totalAccounts} ledger accounts
            </div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Registered Identities</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{stats.totalUsers}</div>
            <div className="text-[11px] text-slate-500 mt-1">Server-enforced RBAC roles</div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Ledger Chain Blocks</span>
              <Hash className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {stats.totalLedgerBlocks}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">SHA-256 hash-linked entries</div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>System Health</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">{stats.status}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              Uptime {stats.uptimeSeconds}s • {stats.nodeVersion}
            </div>
          </div>
        </div>
      )}

      {/* Cryptographic Ledger Verification Section */}
      {(section === 'overview' || section === 'ledger') && (
        <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  Cryptographic Ledger Integrity Verification
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Recomputes and audits every SHA-256 hash pointer from Block #1 to detect unauthorized edits.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleVerifyLedger}
              disabled={verifying}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-400 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 shrink-0"
            >
              {verifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>{verifying ? 'Verifying Chain...' : 'Verify SHA-256 Chain'}</span>
            </button>
          </div>

          {verificationResult && (
            <div
              className={`p-4 rounded-xl border space-y-3 ${
                verificationResult.isValid
                  ? 'bg-emerald-500/5 border-emerald-500/25'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {verificationResult.isValid ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span
                    className={`text-sm font-bold ${
                      verificationResult.isValid ? 'text-emerald-300' : 'text-red-300'
                    }`}
                  >
                    {verificationResult.isValid
                      ? 'CHAIN VERIFIED — ZERO TAMPERING DETECTED'
                      : `TAMPER ALERT AT BLOCK #${verificationResult.tamperedBlockSequence}`}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  Verified: {new Date(verificationResult.verifiedAt).toLocaleString()}
                </span>
              </div>

              <p className="text-xs text-slate-300">{verificationResult.details}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-500 mb-1">Genesis Link</div>
                  <div className="text-slate-300 break-all">{verificationResult.genesisHash}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-500 mb-1">
                    Latest Tip Hash ({verificationResult.totalBlocks} blocks)
                  </div>
                  <div className="text-emerald-400 break-all">
                    {verificationResult.latestHash || 'No blocks yet'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Admin-Only User Management */}
      {isAdmin && section === 'overview' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white">Identity &amp; Access Management</h2>
              <p className="text-xs text-slate-400">
                Suspend compromised accounts (revokes live JWT sessions immediately) or approve KYC.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user or account #"
                  className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-48"
                />
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value as any)}
                aria-label="Filter users by role"
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Roles</option>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="AUDITOR">AUDITOR</option>
              </select>
              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value as any)}
                aria-label="Filter users by status"
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Accounts</th>
                  <th className="py-3 px-4">Balance</th>
                  <th className="py-3 px-4">Status / KYC</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{u.fullName}</div>
                        <div className="text-slate-400 text-[11px]">{u.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                            u.role === 'ADMIN'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : u.role === 'AUDITOR'
                              ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {u.accounts?.map((a: any) => a.accountNumber).join(', ') || 'None'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-white">
                        {u.totalBalanceFormatted}
                      </td>
                      <td className="py-3.5 px-4 space-y-1">
                        <div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {u.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">KYC: {u.kycStatus}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {u.kycStatus !== 'APPROVED' && (
                            <button
                              type="button"
                              disabled={updatingUserId === u.id}
                              onClick={() => handleApproveKyc(u.id, u.email)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/25 font-medium transition disabled:opacity-50"
                            >
                              Approve KYC
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={updatingUserId === u.id}
                            onClick={() => handleToggleUserStatus(u.id, u.status, u.email)}
                            className={`px-2.5 py-1.5 rounded-lg font-medium border transition inline-flex items-center gap-1 disabled:opacity-50 ${
                              u.status === 'SUSPENDED'
                                ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30'
                                : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border-red-500/25'
                            }`}
                          >
                            {u.status === 'SUSPENDED' ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Activate</span>
                              </>
                            ) : (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                <span>Suspend</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Immutable Audit Trail Section */}
      {(section === 'overview' || section === 'audit') && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                <FileSearch className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Immutable Security Audit Trail</h2>
                <p className="text-xs text-slate-400">
                  Showing {auditLogs.length} of {auditTotal} append-only system security events
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {section === 'overview' && onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('audit')}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
                >
                  Open Full Explorer
                </button>
              )}
              <form onSubmit={handleAuditFilterSubmit} className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Filter email, action, ref..."
                    className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-52"
                  />
                </div>
                <select
                  value={auditSeverity}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAuditSeverity(val);
                    setAuditPage(0);
                    fetchAuditLogs({ severity: val, page: 0 });
                  }}
                  aria-label="Filter logs by severity"
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Severities</option>
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="SECURITY_ALERT">SECURITY_ALERT</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
                <button
                  type="submit"
                  disabled={loadingAudit}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition"
                >
                  Apply
                </button>
              </form>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loadingAudit ? (
              <div className="py-12 flex items-center justify-center gap-2 text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span>Querying audit logs...</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase font-mono border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Event Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500 font-sans">
                        No audit events match your current filters.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition align-top">
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.severity === 'SECURITY_ALERT' || log.severity === 'CRITICAL'
                                ? 'bg-red-500/15 text-red-400'
                                : log.severity === 'WARNING'
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {log.severity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-white font-semibold whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                          {log.actorEmail || 'system'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-md break-all">
                          {typeof log.details === 'string'
                            ? log.details
                            : JSON.stringify(log.details)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {section === 'audit' && auditTotal > AUDIT_LIMIT && (
            <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Page {auditPage + 1} of {Math.max(1, Math.ceil(auditTotal / AUDIT_LIMIT))}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={auditPage === 0 || loadingAudit}
                  onClick={() => {
                    const next = Math.max(0, auditPage - 1);
                    setAuditPage(next);
                    fetchAuditLogs({ page: next });
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={(auditPage + 1) * AUDIT_LIMIT >= auditTotal || loadingAudit}
                  onClick={() => {
                    const next = auditPage + 1;
                    setAuditPage(next);
                    fetchAuditLogs({ page: next });
                  }}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
