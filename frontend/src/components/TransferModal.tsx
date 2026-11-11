import React, { useRef, useState } from 'react';
import { ArrowLeftRight, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { ApiClient } from '../services/api';

interface TransferModalProps {
  accounts: any[];
  onClose: () => void;
  onSuccess: () => void;
  defaultFromAccountId?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT_NUM_REGEX = /^BV-\d{6}$/i;

export const TransferModal: React.FC<TransferModalProps> = ({
  accounts,
  onClose,
  onSuccess,
  defaultFromAccountId,
}) => {
  const activeAccounts = accounts.filter((a) => a.status === 'ACTIVE');
  const selectable = activeAccounts.length > 0 ? activeAccounts : accounts;

  const [fromAccountId, setFromAccountId] = useState(
    defaultFromAccountId || selectable[0]?.id || ''
  );
  const [toAccountId, setToAccountId] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ reference: string; blockHash: string } | null>(
    null
  );
  const inFlightKeyRef = useRef<string | null>(null);

  const selectedSource = accounts.find((a) => a.id === fromAccountId);
  const otherOwnAccounts = accounts.filter((a) => a.id !== fromAccountId && a.status === 'ACTIVE');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);

    const dest = toAccountId.trim();
    if (!fromAccountId) {
      setError('Select a valid source account.');
      return;
    }
    if (!UUID_REGEX.test(dest) && !ACCOUNT_NUM_REGEX.test(dest)) {
      setError('Enter a valid destination Account Number (e.g. BV-200202) or Account UUID.');
      return;
    }
    if (
      dest === fromAccountId ||
      (selectedSource && dest.toUpperCase() === selectedSource.accountNumber.toUpperCase())
    ) {
      setError('Self-transfers are not permitted. Choose a different destination account.');
      return;
    }

    const amountFloat = parseFloat(amountDollars);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      setError('Enter a positive transfer amount greater than $0.00.');
      return;
    }
    const amountCents = Math.round(amountFloat * 100);
    if (amountCents <= 0 || amountCents > 100_000_000) {
      setError('Transfer must be between $0.01 and $1,000,000.00.');
      return;
    }

    const key = inFlightKeyRef.current || ApiClient.createIdempotencyKey();
    inFlightKeyRef.current = key;

    try {
      setLoading(true);
      const res = await ApiClient.transfer({
        fromAccountId,
        toAccountId: ACCOUNT_NUM_REGEX.test(dest) ? dest.toUpperCase() : dest,
        amount: amountCents,
        description: description.trim() || undefined,
        idempotencyKey: key,
      });

      inFlightKeyRef.current = null;
      setSuccessInfo({
        reference: res.data.transactionReference,
        blockHash: res.data.blockHash,
      });
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      if (err?.code !== 'DUPLICATE_TRANSACTION') {
        inFlightKeyRef.current = null;
      }
      setError(err.message || 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-modal-title"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h3 id="transfer-modal-title" className="text-base font-bold text-white">
                Send Money
              </h3>
              <p className="text-xs text-slate-400">
                Double-entry transfer anchored in SHA-256 ledger
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successInfo && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <div>
                <div className="font-semibold">Transfer Settled ({successInfo.reference})</div>
                <div className="font-mono text-[10px] text-emerald-400/80 truncate max-w-[300px]">
                  Hash: {successInfo.blockHash}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              From Account
            </label>
            <select
              value={fromAccountId}
              onChange={(e) => {
                setFromAccountId(e.target.value);
                inFlightKeyRef.current = null;
              }}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500 transition"
            >
              {selectable.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountNumber} ({acc.type}) — {acc.cachedBalanceFormatted}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Destination Account Number or UUID
            </label>
            <input
              type="text"
              required
              value={toAccountId}
              onChange={(e) => {
                setToAccountId(e.target.value);
                inFlightKeyRef.current = null;
              }}
              placeholder="BV-200202 or account UUID"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
            {otherOwnAccounts.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] text-slate-500">Own accounts:</span>
                {otherOwnAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setToAccountId(acc.accountNumber)}
                    className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-indigo-300 transition"
                  >
                    {acc.accountNumber} ({acc.type})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Amount ($ USD)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-500 text-sm font-semibold">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="1000000"
                required
                value={amountDollars}
                onChange={(e) => {
                  setAmountDollars(e.target.value);
                  inFlightKeyRef.current = null;
                }}
                placeholder="100.00"
                className="w-full pl-8 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Memo / Reference <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              maxLength={255}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Invoice payment, savings transfer, etc."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || Boolean(successInfo) || selectable.length === 0}
              className="px-5 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-emerald-950/50 transition flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Settling...' : 'Confirm Transfer'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
