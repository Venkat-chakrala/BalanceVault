import React, { useMemo, useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  PlusCircle,
  Copy,
  Check,
  Search,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Landmark,
  Clock,
  Loader2,
  UserCheck,
  LogOut,
  FileText,
} from 'lucide-react';
import { ApiClient } from '../services/api';
import type { RouteView } from './Sidebar';

export interface AccountItem {
  id: string;
  accountNumber: string;
  type: string;
  cachedBalanceCents: number;
  cachedBalanceFormatted: string;
  currency: string;
  status: string;
  version?: number;
  createdAt?: string;
}

export interface TransactionEntryItem {
  entryId: string;
  transactionId: string;
  reference: string;
  type: string;
  entryType: 'CREDIT' | 'DEBIT';
  amountCents: number;
  amountFormatted: string;
  balanceAfterCents: number;
  balanceAfterFormatted: string;
  description: string;
  counterpartyAccount: string;
  cryptographicHash: string | null;
  createdAt: string;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function summarizeTransactions(entries: TransactionEntryItem[]) {
  let inflowCents = 0;
  let outflowCents = 0;
  for (const tx of entries) {
    if (tx.entryType === 'CREDIT') inflowCents += tx.amountCents;
    else outflowCents += tx.amountCents;
  }
  return {
    inflowCents,
    outflowCents,
    netCents: inflowCents - outflowCents,
    count: entries.length,
  };
}

interface TransactionTableProps {
  entries: TransactionEntryItem[];
  loading: boolean;
  emptyText: string;
  onViewProof: (reference: string) => void;
}

const TransactionTable: React.FC<TransactionTableProps> = ({
  entries,
  loading,
  emptyText,
  onViewProof,
}) => {
  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center gap-2 text-xs text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
        <span>Synchronizing double-entry ledger...</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return <div className="py-10 text-center text-xs text-slate-500">{emptyText}</div>;
  }

  return (
    <div className="divide-y divide-slate-800/70">
      {entries.map((tx) => {
        const isCredit = tx.entryType === 'CREDIT';
        return (
          <div
            key={tx.entryId}
            className="p-4 hover:bg-slate-800/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`p-2 rounded-xl border shrink-0 mt-0.5 ${
                  isCredit
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}
              >
                {isCredit ? (
                  <ArrowDownLeft className="w-4 h-4" />
                ) : (
                  <ArrowUpRight className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">
                    {tx.description || `${tx.type} Entry`}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                    {tx.type}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-400">
                  <span>Ref: {tx.reference}</span>
                  <span>
                    {isCredit ? 'From:' : 'To:'}{' '}
                    {tx.counterpartyAccount === 'SYSTEM'
                      ? 'External Deposit'
                      : tx.counterpartyAccount}
                  </span>
                  <span className="text-slate-500">
                    {new Date(tx.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
              <div className="text-left sm:text-right font-mono">
                <div
                  className={`text-sm font-bold ${
                    isCredit ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {isCredit ? '+' : '-'}
                  {tx.amountFormatted}
                </div>
                <div className="text-[11px] text-slate-500">
                  Bal: {tx.balanceAfterFormatted}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onViewProof(tx.reference)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-emerald-300 transition flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Proof</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 1. Overview Dashboard                                                      */
/* -------------------------------------------------------------------------- */
export const OverviewView: React.FC<{
  user: any;
  accounts: AccountItem[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  transactions: TransactionEntryItem[];
  loadingTx: boolean;
  errorTx: string | null;
  onRefresh: () => void;
  onNavigate: (view: RouteView) => void;
  onOpenTransfer: () => void;
  onOpenDeposit: () => void;
  onViewProof: (reference: string) => void;
}> = ({
  user,
  accounts,
  selectedAccountId,
  onSelectAccount,
  transactions,
  loadingTx,
  errorTx,
  onRefresh,
  onNavigate,
  onOpenTransfer,
  onOpenDeposit,
  onViewProof,
}) => {
  const totalBalanceCents = useMemo(
    () => accounts.reduce((sum, a) => sum + (a.cachedBalanceCents ?? 0), 0),
    [accounts]
  );
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];
  const summary = useMemo(() => summarizeTransactions(transactions), [transactions]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Total Portfolio Balance</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {formatCents(totalBalanceCents)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {accounts.length} active ledger account{accounts.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Recent Credits (Inflow)</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            +{formatCents(summary.inflowCents)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Selected: {selectedAccount?.accountNumber || '—'}
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Recent Debits (Outflow)</span>
            <ArrowUpRight className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-red-400 font-mono">
            -{formatCents(summary.outflowCents)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {summary.count} settled ledger entries
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Verification &amp; Status</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-white flex items-center gap-2">
            <span>KYC: {user.kycStatus}</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 mt-1 font-medium transition"
          >
            {user.kycStatus === 'APPROVED' ? 'View security details →' : 'Complete KYC profile →'}
          </button>
        </div>
      </div>

      {/* Primary Account Banner + Quick Actions */}
      {selectedAccount && (
        <div className="p-5 sm:p-6 bg-gradient-to-br from-slate-900 to-slate-900/70 border border-slate-800 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={selectedAccount.id}
                onChange={(e) => onSelectAccount(e.target.value)}
                aria-label="Select active vault account"
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountNumber} ({acc.type}) — {acc.cachedBalanceFormatted}
                  </option>
                ))}
              </select>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                  selectedAccount.status === 'ACTIVE'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                    : 'bg-red-500/15 text-red-400 border-red-500/25'
                }`}
              >
                {selectedAccount.status}
              </span>
            </div>

            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">
                Available Balance ({selectedAccount.currency})
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-white font-mono mt-1">
                {selectedAccount.cachedBalanceFormatted}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenTransfer}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-950/50 transition flex items-center gap-2"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Send Money</span>
            </button>
            <button
              type="button"
              onClick={onOpenDeposit}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold rounded-xl transition flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Deposit Funds</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('accounts')}
              className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition flex items-center gap-2"
            >
              <Landmark className="w-4 h-4 text-indigo-400" />
              <span>Accounts</span>
            </button>
          </div>
        </div>
      )}

      {/* Recent Transactions Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Recent Transactions</h2>
            <p className="text-xs text-slate-400">
              Verified entries for account {selectedAccount?.accountNumber || '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('transactions')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition"
            >
              Full History →
            </button>
          </div>
        </div>

        {errorTx && (
          <div className="m-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorTx}</span>
          </div>
        )}

        <TransactionTable
          entries={transactions.slice(0, 6)}
          loading={loadingTx}
          emptyText="No transactions recorded on this account yet."
          onViewProof={onViewProof}
        />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. Accounts Management                                                     */
/* -------------------------------------------------------------------------- */
export const AccountsView: React.FC<{
  accounts: AccountItem[];
  onSelectAccountAndViewTx: (accountId: string) => void;
  onSelectAccountAndTransfer: (accountId: string) => void;
  onAccountCreated: () => Promise<void>;
}> = ({
  accounts,
  onSelectAccountAndViewTx,
  onSelectAccountAndTransfer,
  onAccountCreated,
}) => {
  const [newType, setNewType] = useState<'CHECKING' | 'SAVINGS'>('SAVINGS');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(
    null
  );

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleOpenAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      setFeedback(null);
      const res = await ApiClient.createAccount(newType);
      setFeedback({
        type: 'success',
        message: `Opened ${newType} account ${res.data.accountNumber} cleanly.`,
      });
      await onAccountCreated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Unable to open new account.' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          role="alert"
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'bg-red-500/10 border-red-500/25 text-red-400'
              : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Existing Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between gap-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300 font-semibold">
                  {acc.type}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                    acc.status === 'ACTIVE'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-red-500/15 text-red-400'
                  }`}
                >
                  {acc.status}
                </span>
              </div>

              <div>
                <div className="text-xs text-slate-400">Available Balance</div>
                <div className="text-2xl font-bold text-white font-mono mt-0.5">
                  {acc.cachedBalanceFormatted}
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
                <span className="text-slate-300">{acc.accountNumber}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(acc.id, acc.accountNumber)}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  {copiedId === acc.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => onSelectAccountAndViewTx(acc.id)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
              >
                Ledger Entries
              </button>
              <button
                type="button"
                disabled={acc.status !== 'ACTIVE'}
                onClick={() => onSelectAccountAndTransfer(acc.id)}
                className="py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-40 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition"
              >
                Send Funds
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Open Secondary Account */}
      <form
        onSubmit={handleOpenAccount}
        className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">Open Additional Vault Account</h3>
          <p className="text-xs text-slate-400">
            Provision a dedicated Checking or Savings ledger account backed by SQLite atomic transactions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as 'CHECKING' | 'SAVINGS')}
            aria-label="Account type"
            className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="SAVINGS">SAVINGS Account</option>
            <option value="CHECKING">CHECKING Account</option>
          </select>
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
            <span>{creating ? 'Provisioning...' : 'Open Account'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. Transfers Hub                                                           */
/* -------------------------------------------------------------------------- */
export const TransfersView: React.FC<{
  accounts: AccountItem[];
  transactions: TransactionEntryItem[];
  loadingTx: boolean;
  onOpenTransfer: () => void;
  onOpenDeposit: () => void;
  onViewProof: (reference: string) => void;
}> = ({ accounts, transactions, loadingTx, onOpenTransfer, onOpenDeposit, onViewProof }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyNum = (id: string, accNum: string) => {
    navigator.clipboard.writeText(accNum);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">Double-Entry Money Movement</h2>
            <p className="text-xs text-slate-400">
              Every transfer atomically debits source, credits destination, enforces idempotency, and links a SHA-256 block.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onOpenTransfer}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>New Account Transfer</span>
            </button>
            <button
              type="button"
              onClick={onOpenDeposit}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold rounded-xl transition flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Deposit Funds</span>
            </button>
          </div>
        </div>

        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2.5">
          <div className="text-xs font-semibold text-slate-300">Your Receiving Account Numbers</div>
          <div className="space-y-2">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono"
              >
                <div>
                  <span className="text-white font-semibold">{acc.accountNumber}</span>
                  <span className="text-slate-500 ml-2">{acc.type}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyNum(acc.id, acc.accountNumber)}
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  {copiedId === acc.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800">
          <h3 className="text-base font-bold text-white">Recent Transfers &amp; Deposits</h3>
        </div>
        <TransactionTable
          entries={transactions}
          loading={loadingTx}
          emptyText="No transfers or deposits recorded for this account yet."
          onViewProof={onViewProof}
        />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. Transaction History + Search & Filters                                  */
/* -------------------------------------------------------------------------- */
export const TransactionsView: React.FC<{
  accounts: AccountItem[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  transactions: TransactionEntryItem[];
  loadingTx: boolean;
  errorTx: string | null;
  onRefresh: () => void;
  onViewProof: (reference: string) => void;
}> = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
  transactions,
  loadingTx,
  errorTx,
  onRefresh,
  onViewProof,
}) => {
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [txType, setTxType] = useState<'ALL' | 'TRANSFER' | 'DEPOSIT'>('ALL');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (direction !== 'ALL' && t.entryType !== direction) return false;
      if (txType !== 'ALL' && t.type !== txType) return false;
      if (!q) return true;
      return (
        t.reference.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.counterpartyAccount || '').toLowerCase().includes(q) ||
        (t.cryptographicHash || '').toLowerCase().includes(q)
      );
    });
  }, [transactions, search, direction, txType]);

  const summary = useMemo(() => summarizeTransactions(filtered), [filtered]);

  return (
    <div className="space-y-6">
      {/* Real Backend-Computed Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-xs text-slate-400">Filtered Entries</div>
          <div className="text-xl font-bold text-white font-mono mt-1">{summary.count}</div>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-xs text-slate-400">Total Credits</div>
          <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
            +{formatCents(summary.inflowCents)}
          </div>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-xs text-slate-400">Total Debits</div>
          <div className="text-xl font-bold text-red-400 font-mono mt-1">
            -{formatCents(summary.outflowCents)}
          </div>
        </div>
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="text-xs text-slate-400">Net Movement</div>
          <div
            className={`text-xl font-bold font-mono mt-1 ${
              summary.netCents >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {summary.netCents >= 0 ? '+' : '-'}
            {formatCents(Math.abs(summary.netCents))}
          </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedAccountId}
              onChange={(e) => onSelectAccount(e.target.value)}
              aria-label="Filter by account"
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountNumber} ({acc.type}) — {acc.cachedBalanceFormatted}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onRefresh}
              className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ref, memo, account, hash..."
                className="pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-60"
              />
            </div>

            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as any)}
              aria-label="Filter by entry direction"
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Entries</option>
              <option value="CREDIT">Credits Only</option>
              <option value="DEBIT">Debits Only</option>
            </select>

            <select
              value={txType}
              onChange={(e) => setTxType(e.target.value as any)}
              aria-label="Filter by transaction type"
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Types</option>
              <option value="TRANSFER">Transfers</option>
              <option value="DEPOSIT">Deposits</option>
            </select>
          </div>
        </div>

        {errorTx && (
          <div className="m-4 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-400 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorTx}</span>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 font-medium"
            >
              Retry
            </button>
          </div>
        )}

        <TransactionTable
          entries={filtered}
          loading={loadingTx}
          emptyText="No ledger entries match the selected filters."
          onViewProof={onViewProof}
        />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 5. Profile, KYC & Security                                                 */
/* -------------------------------------------------------------------------- */
export const ProfileView: React.FC<{
  user: any;
  onProfileUpdated: () => Promise<void>;
  onRequestLogout: () => void;
}> = ({ user, onProfileUpdated, onRequestLogout }) => {
  const [fullName, setFullName] = useState(user.fullName || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  const [docType, setDocType] = useState(user.kycDocumentType || 'Passport');
  const [docNumber, setDocNumber] = useState('');
  const [savingKyc, setSavingKyc] = useState(false);
  const [kycMsg, setKycMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    if (fullName.trim().length < 2) {
      setProfileMsg({ type: 'error', text: 'Full name must contain at least 2 characters.' });
      return;
    }

    try {
      setSavingProfile(true);
      await ApiClient.updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || null,
      });
      await onProfileUpdated();
      setProfileMsg({ type: 'success', text: 'Profile information saved to server.' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Could not update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setKycMsg(null);
    if (docNumber.trim().length < 4) {
      setKycMsg({
        type: 'error',
        text: 'Document identification number must be at least 4 characters.',
      });
      return;
    }

    try {
      setSavingKyc(true);
      await ApiClient.submitKyc({
        documentType: docType,
        documentNumber: docNumber.trim(),
      });
      setDocNumber('');
      await onProfileUpdated();
      setKycMsg({ type: 'success', text: 'KYC document submitted for administrator verification.' });
    } catch (err: any) {
      setKycMsg({ type: 'error', text: err.message || 'KYC submission failed.' });
    } finally {
      setSavingKyc(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Editable Identity Form */}
      <form
        onSubmit={handleSaveProfile}
        className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4"
      >
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Identity Profile</h2>
            <p className="text-xs text-slate-400">Account credentials and contact details</p>
          </div>
        </div>

        {profileMsg && (
          <div
            className={`p-3 rounded-xl text-xs border ${
              profileMsg.type === 'error'
                ? 'bg-red-500/10 border-red-500/25 text-red-400'
                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
            }`}
          >
            {profileMsg.text}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Email (Immutable)</label>
          <input
            type="email"
            disabled
            value={user.email}
            className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-slate-400 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Not provided"
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500">Assigned Role</div>
            <div className="font-mono font-semibold text-white mt-0.5">{user.role}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500">Account Standing</div>
            <div className="font-mono font-semibold text-emerald-400 mt-0.5">{user.status}</div>
          </div>
        </div>

        <button
          type="submit"
          disabled={savingProfile}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2"
        >
          {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{savingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
        </button>
      </form>

      {/* KYC Verification + Active Session */}
      <div className="space-y-6">
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">KYC Compliance</h2>
                <p className="text-xs text-slate-400">Identity verification record</p>
              </div>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${
                user.kycStatus === 'APPROVED'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              {user.kycStatus}
            </span>
          </div>

          {kycMsg && (
            <div
              className={`p-3 rounded-xl text-xs border ${
                kycMsg.type === 'error'
                  ? 'bg-red-500/10 border-red-500/25 text-red-400'
                  : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
              }`}
            >
              {kycMsg.text}
            </div>
          )}

          {user.kycStatus === 'APPROVED' ? (
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-slate-300 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Identity verified
                {user.kycDocumentType ? ` (${user.kycDocumentType})` : ''}. Full transaction limits enabled.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmitKyc} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Passport">Passport</option>
                  <option value="National ID">National ID</option>
                  <option value="Drivers License">Driver&apos;s License</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Document Identification Number
                </label>
                <input
                  type="text"
                  required
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="Enter ID number"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={savingKyc}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition flex items-center gap-2"
              >
                {savingKyc && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{savingKyc ? 'Submitting...' : 'Submit KYC Verification'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Session Control Card */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Authenticated Session</span>
            </div>
            <p className="text-xs text-slate-400">
              Member since {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}. Signing out revokes your active JWT immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestLogout}
            className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/25 text-red-400 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

