import React, { useState } from 'react';
import { ArrowRightLeft, X, AlertCircle } from 'lucide-react';
import { ApiClient } from '../services/api';

interface TransferModalProps {
  accounts: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({ accounts, onClose, onSuccess }) => {
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAccount = accounts.find((a) => a.id === fromAccountId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountFloat = parseFloat(amountDollars);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      setError('Please enter a valid positive dollar amount.');
      return;
    }

    const amountCents = Math.round(amountFloat * 100);

    if (activeAccount && amountCents > activeAccount.cachedBalanceCents) {
      setError(`Insufficient funds. Your available balance is ${activeAccount.cachedBalanceFormatted}.`);
      return;
    }

    if (!toAccountId.trim()) {
      setError('Destination account ID or counterparty UUID is required.');
      return;
    }

    if (fromAccountId === toAccountId) {
      setError('Self-transfer is forbidden. Source and destination must differ.');
      return;
    }

    try {
      setLoading(true);
      await ApiClient.transfer({
        fromAccountId,
        toAccountId: toAccountId.trim(),
        amount: amountCents,
        description: description || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Execute Money Movement</h3>
              <p className="text-xs text-slate-400">Double-entry balanced transaction</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* From Account */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Source Account (Debited)
            </label>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountNumber} ({acc.type}) — {acc.cachedBalanceFormatted} available
                </option>
              ))}
            </select>
          </div>

          {/* Destination Account ID */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Destination Account ID (Credited)
            </label>
            <input
              type="text"
              required
              placeholder="e.g. paste destination account UUID"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Tip: You can transfer to Bob's or Alice's account listed in the Evaluator Benchmark Bar above!
            </p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Transfer Amount ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-sm font-semibold">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                className="w-full pl-8 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
            {amountDollars && !isNaN(parseFloat(amountDollars)) && (
              <span className="text-[11px] text-emerald-400 mt-1 block">
                = {Math.round(parseFloat(amountDollars) * 100)} integer cents (stored without precision loss)
              </span>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Transaction Memo / Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Invoice #204 settlement"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-emerald-900/30 transition flex items-center gap-2"
            >
              {loading ? 'Anchoring in Ledger...' : 'Confirm & Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
