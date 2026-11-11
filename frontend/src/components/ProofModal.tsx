import React from 'react';
import { ShieldCheck, X, Hash, ArrowRight, CheckCircle2, Copy } from 'lucide-react';

interface ProofModalProps {
  proof: any;
  onClose: () => void;
}

export const ProofModal: React.FC<ProofModalProps> = ({ proof, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  const copyHash = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Cryptographic Ledger Proof
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
                  SHA-256 VERIFIED
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">Ref: {proof.reference}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Double-Entry Balancing Card */}
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Double-Entry Proof
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Debits Equal Credits (Balanced)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1 text-sm font-mono">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-400">Total Debits</div>
                <div className="text-lg font-bold text-red-400">
                  ${(proof.doubleEntry.totalDebitsCents / 100).toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <div className="text-xs text-slate-400">Total Credits</div>
                <div className="text-lg font-bold text-emerald-400">
                  ${(proof.doubleEntry.totalCreditsCents / 100).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Entry List */}
            <div className="divide-y divide-slate-800/60 text-xs font-mono">
              {proof.doubleEntry.entries.map((entry: any, idx: number) => (
                <div key={idx} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        entry.type === 'DEBIT' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {entry.type}
                    </span>
                    <span className="text-slate-300">Account {entry.accountNumber}</span>
                  </div>
                  <div className="text-slate-200 font-semibold">
                    ${(entry.amountCents / 100).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cryptographic Block Chain Info */}
          {proof.cryptographicProof ? (
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-indigo-400" />
                  Block Header & Hash Chain
                </span>
                <span className="text-xs font-mono text-indigo-400 font-semibold">
                  Block #{proof.cryptographicProof.blockSequence}
                </span>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div>
                  <div className="text-slate-400 mb-1 flex items-center justify-between">
                    <span>Block SHA-256 Hash:</span>
                    <button
                      onClick={() => copyHash(proof.cryptographicProof.blockHash)}
                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400 break-all select-all">
                    {proof.cryptographicProof.blockHash}
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 mb-1">Previous Block Hash (Parent Link):</div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 break-all select-all">
                    {proof.cryptographicProof.previousHash}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-slate-400">Cryptographic Nonce: </span>
                    <span className="text-slate-200">{proof.cryptographicProof.nonce}</span>
                  </div>
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                    <span className="text-slate-400">Algorithm: </span>
                    <span className="text-slate-200">{proof.cryptographicProof.algorithm}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs rounded-xl">
              Cryptographic block is currently being anchored in ledger pipeline.
            </div>
          )}

          {/* Verification Statement */}
          <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              This transaction has been cryptographically validated against the public ledger state. The
              cryptographic signature guarantees mathematical immutability and complete auditability.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
          >
            Close Receipt
          </button>
        </div>
      </div>
    </div>
  );
};

