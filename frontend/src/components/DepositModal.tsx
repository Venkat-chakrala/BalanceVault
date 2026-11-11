import React, { useRef, useState } from 'react';
import { PlusCircle, X, AlertCircle, Loader2 } from 'lucide-react';
import { ApiClient } from '../services/api';

interface DepositModalProps {
  accounts: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({ accounts, onClose, onSuccess }) => {
  const activeAccounts = accounts.filter((a) => a.status === 'ACTIVE');
  const selectableAccounts = activeAccounts.length > 0 ? activeAccounts : accounts;
  const [accountId, setAccountId] = useState(selectableAccounts[0]?.id || '');
  const [amountDollars, setAmountDollars] = useState('500.00');
  const [description, setDescription] = useState('Wire Deposit');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightKeyRef = useRef<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!accountId) {
      setError('Please select a target account.');
      return;
    }

    const amountFloat = parseFloat(amountDollars);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      setError('Please enter a valid positive deposit amount.');
      return;
    }

    const amountCents = Math.round(amountFloat * 100);
    if (amountCents <= 0 || amountCents > 100_000_000) {
      setError('Deposit must be between $0.01 and $1,000,000.00.');
      return;
    }

    const key = inFlightKeyRef.current || ApiClient.createIdempotencyKey();
    inFlightKeyRef.current = key;

    try {
      setLoading(true);
      await ApiClient.deposit({
        accountId,
        amount: amountCents,
        description: description.trim() || undefined,
        idempotencyKey: key,
      });

      inFlightKeyRef.current = null;
      onSuccess();
      onClose();
    } catch (err: any) {
      if (err?.code !== 'DUPLICATE_TRANSACTION') {
        inFlightKeyRef.current = null;
      }
      setError(err.message || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Deposit Synthetic Funds</h3>
              <p className="text-xs text-slate-400">Credits checking account with ledger block</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Target Account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountNumber} ({acc.type}) — {acc.cachedBalanceFormatted}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Deposit Amount ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-sm font-semibold">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                className="w-full pl-8 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Deposit Memo</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || selectableAccounts.length === 0}
              className="px-5 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Processing...' : 'Add Funds'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

