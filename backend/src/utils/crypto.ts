import crypto from 'crypto';

export const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export interface BlockPayload {
  sequenceNumber: number;
  previousHash: string;
  transactionId: string;
  reference: string;
  amount: number;
  fromAccountId: string | null;
  toAccountId: string | null;
  timestamp: string | Date;
  nonce: string;
}

/**
 * Calculates SHA-256 hash for a ledger block payload.
 * Provides deterministic hashing ensuring tamper-evidence.
 */
export function calculateBlockHash(payload: BlockPayload): string {
  const ts = payload.timestamp instanceof Date ? payload.timestamp.toISOString() : payload.timestamp;
  const canonicalString = [
    payload.sequenceNumber,
    payload.previousHash,
    payload.transactionId,
    payload.reference,
    payload.amount,
    payload.fromAccountId || 'SYSTEM',
    payload.toAccountId || 'SYSTEM',
    ts,
    payload.nonce,
  ].join('|');

  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Generates a cryptographically secure random nonce.
 */
export function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates an immutable transaction reference string.
 * Example: TXN-20261110-A1B2C3D4
 */
export function generateTransactionReference(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `TXN-${dateStr}-${randomHex}`;
}

