import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Users,
  Activity,
  AlertTriangle,
  Lock,
  Unlock,
  CheckCircle,
  Clock,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { ApiClient } from '../services/api';

interface AdminViewProps {
  currentUserRole: string;
}

export const AdminView: React.FC<AdminViewProps> = ({ currentUserRole }) => {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [verification, setVerification] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const isAdmin = currentUserRole === 'ADMIN';

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, auditRes] = await Promise.all([
        ApiClient.getStats(),
        ApiClient.getAuditTrail(30),
      ]);

      setStats(statsRes.data);
      setAuditLogs(auditRes.data.logs);

      if (isAdmin) {
        const usersRes = await ApiClient.getUsers();
        setUsers(usersRes.data.users);
      }
    } catch (err: any) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUserRole]);

  const handleVerifyLedger = async () => {
    try {
      setVerifying(true);
      const res = await ApiClient.verifyLedger();
      setVerification(res.data);
      loadData();
    } catch (err: any) {
      alert(`Ledger verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const handleToggleUserStatus = async (user: any) => {
    const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await ApiClient.updateUser(user.id, { status: newStatus });
      setActionMessage(`User ${user.email} marked as ${newStatus}. All active sessions immediately revoked.`);
      setTimeout(() => setActionMessage(null), 4000);
      loadData();
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleApproveKyc = async (user: any) => {
    try {
      await ApiClient.updateUser(user.id, { kycStatus: 'APPROVED' });
      setActionMessage(`KYC approved for ${user.email}.`);
      setTimeout(() => setActionMessage(null), 4000);
      loadData();
    } catch (err: any) {
      alert(`Failed to approve KYC: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Action Notification */}
      {actionMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-xs text-slate-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Top Banner: Cryptographic Ledger Verification */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Cryptographic Ledger Integrity Proof
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-mono">
                  SHA-256 HASH CHAIN
                </span>
              </h2>
              <p className="text-xs text-slate-400 max-w-xl mt-1">
                Recalculates the cryptographic hash chain from Genesis block to latest block across all
                database transactions, validating zero out-of-band tampering.
              </p>
            </div>
          </div>

          <button
            onClick={handleVerifyLedger}
            disabled={verifying}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-900/30 transition flex items-center gap-2 whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} />
            {verifying ? 'Verifying Chain...' : 'Run Mathematical Verification'}
          </button>
        </div>

        {/* Verification Result Card */}
        {verification && (
          <div className="mt-6 p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Status:</span>
              <span
                className={`font-bold flex items-center gap-1.5 ${
                  verification.isValid ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {verification.isValid ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {verification.isValid ? '100% VALID — ZERO TAMPERING DETECTED' : 'TAMPERING DETECTED'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-2.5 bg-slate-900 rounded-lg">
                <span className="text-slate-400">Total Anchored Blocks: </span>
                <span className="text-white font-bold">{verification.totalBlocks}</span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg">
                <span className="text-slate-400">Verified Timestamp: </span>
                <span className="text-slate-300">{new Date(verification.verifiedAt).toLocaleTimeString()}</span>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg">
                <span className="text-slate-400">Genesis Hash: </span>
                <span className="text-slate-400 truncate block">0000...0000</span>
              </div>
            </div>

            {verification.latestHash && (
              <div className="p-2.5 bg-slate-900 rounded-lg">
                <div className="text-slate-400 mb-1">Latest Block SHA-256 Hash:</div>
                <div className="text-indigo-400 break-all select-all">{verification.latestHash}</div>
              </div>
            )}

            <div className="text-slate-300 pt-1">{verification.details}</div>
          </div>
        )}
      </div>

      {/* System Metrics */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Total Vault Balance</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{stats.totalVaultBalanceFormatted}</div>
            <div className="text-[11px] text-slate-500 mt-1">Across all checking accounts</div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Cryptographic Blocks</span>
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{stats.totalLedgerBlocks}</div>
            <div className="text-[11px] text-slate-500 mt-1">Immutable SHA-256 chain</div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Registered Accounts</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{stats.totalUsers}</div>
            <div className="text-[11px] text-slate-500 mt-1">{stats.totalAccounts} provisioned wallets</div>
          </div>

          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
              <span>Server Uptime</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{stats.uptimeSeconds}s</div>
            <div className="text-[11px] text-emerald-400 mt-1 font-medium">Node {stats.nodeVersion} (Healthy)</div>
          </div>
        </div>
      )}

      {/* User Management Section (Admin Only) */}
      {isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Account Holders & Role Administration</h3>
                <p className="text-xs text-slate-400">Live role management & immediate token revocation</p>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-mono">{users.length} Users</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">KYC Onboarding</th>
                  <th className="p-4">Balance</th>
                  <th className="p-4">Session Revocation</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-4 font-sans">
                      <div className="font-semibold text-white">{u.fullName}</div>
                      <div className="text-slate-400 text-[11px] font-mono">{u.email}</div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-500/20 text-purple-400'
                            : u.role === 'AUDITOR'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.kycStatus === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : u.kycStatus === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {u.kycStatus}
                      </span>
                    </td>
                    <td className="p-4 text-slate-200 font-semibold">{u.totalBalanceFormatted}</td>
                    <td className="p-4 text-slate-400">v{u.tokenVersion}</td>
                    <td className="p-4 text-right space-x-2 font-sans">
                      {u.kycStatus === 'PENDING' && (
                        <button
                          onClick={() => handleApproveKyc(u)}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded border border-emerald-500/30 transition"
                        >
                          Approve KYC
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleUserStatus(u)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition inline-flex items-center gap-1 ${
                          u.status === 'ACTIVE'
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? (
                          <>
                            <Lock className="w-3 h-3" />
                            Suspend
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3 h-3" />
                            Activate
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Immutable System Audit Trail */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Immutable Security Audit Trail</h3>
              <p className="text-xs text-slate-400">Chronological logging of critical system events</p>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-mono">Latest 30 Records</span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 sticky top-0 backdrop-blur-sm">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Severity</th>
                <th className="p-3.5">Action Event</th>
                <th className="p-3.5">Actor</th>
                <th className="p-3.5">IP Address</th>
                <th className="p-3.5">Metadata Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition text-[11px]">
                  <td className="p-3.5 text-slate-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.severity === 'CRITICAL'
                          ? 'bg-red-500/30 text-red-300 border border-red-500/40 animate-pulse'
                          : log.severity === 'SECURITY_ALERT'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : log.severity === 'WARNING'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-700/60 text-slate-300'
                      }`}
                    >
                      {log.severity}
                    </span>
                  </td>
                  <td className="p-3.5 font-bold text-slate-200">{log.action}</td>
                  <td className="p-3.5 text-slate-300 font-sans">{log.actorEmail || 'Anonymous'}</td>
                  <td className="p-3.5 text-slate-400">{log.ipAddress}</td>
                  <td className="p-3.5 text-slate-400 max-w-xs truncate" title={JSON.stringify(log.details)}>
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
