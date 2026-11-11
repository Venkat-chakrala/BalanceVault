import prisma from '../prisma/client';
import {
  calculateBlockHash,
  generateNonce,
  generateTransactionReference,
  GENESIS_PREV_HASH,
} from '../utils/crypto';
import { AuditService } from './audit.service';

export interface TransferParams {
  initiatedById: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number; // in cents, positive integer
  description?: string;
  idempotencyKey?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DepositWithdrawParams {
  initiatedById: string;
  accountId: string;
  amount: number; // in cents
  description?: string;
  idempotencyKey?: string;
  ipAddress?: string;
  userAgent?: string;
}

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const completedIdempotencyKeys = new Map<string, number>();
const inFlightIdempotencyKeys = new Set<string>();

function acquireIdempotencyLock(scopeKey?: string): string | null {
  if (!scopeKey) return null;
  const now = Date.now();
  for (const [key, expiresAt] of completedIdempotencyKeys.entries()) {
    if (expiresAt <= now) completedIdempotencyKeys.delete(key);
  }
  if (inFlightIdempotencyKeys.has(scopeKey) || completedIdempotencyKeys.has(scopeKey)) {
    throw new Error('Duplicate transaction detected. This request has already been submitted.');
  }
  inFlightIdempotencyKeys.add(scopeKey);
  return scopeKey;
}

function finalizeIdempotencyLock(scopeKey: string | null, committed: boolean): void {
  if (!scopeKey) return;
  inFlightIdempotencyKeys.delete(scopeKey);
  if (committed) {
    completedIdempotencyKeys.set(scopeKey, Date.now() + IDEMPOTENCY_TTL_MS);
  }
}

export class LedgerService {
  /**
   * Executes a secure, atomic transfer between two accounts using double-entry bookkeeping
   * and appends a cryptographically chained block to the verifiable ledger.
   */
  static async executeTransfer(params: TransferParams) {
    const {
      initiatedById,
      fromAccountId,
      toAccountId,
      amount,
      description,
      idempotencyKey,
      ipAddress,
      userAgent,
    } = params;

    // 1. Strict Validation
    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('Transfer amount must be a positive integer in cents.');
    }

    const normalizedDest = toAccountId.trim();
    const isDestAccountNumber = /^BV-\d{6}$/i.test(normalizedDest);
    const destLookup = await prisma.account.findUnique({
      where: isDestAccountNumber
        ? { accountNumber: normalizedDest.toUpperCase() }
        : { id: normalizedDest },
    });

    if (!destLookup) {
      throw new Error('Destination account not found.');
    }

    const resolvedToAccountId = destLookup.id;

    if (fromAccountId === resolvedToAccountId) {
      throw new Error('Self-transfer is not permitted. Source and destination accounts must be distinct.');
    }

    const lockKey = acquireIdempotencyLock(
      idempotencyKey ? `transfer:${initiatedById}:${idempotencyKey}` : undefined
    );
    let committed = false;

    try {
      // Pre-transaction authorization check to ensure security audit log persists even on rejection
      const preCheckAccount = await prisma.account.findUnique({
        where: { id: fromAccountId },
        include: { user: true },
      });

      if (preCheckAccount) {
        const initiator = await prisma.user.findUnique({ where: { id: initiatedById } });
        if (initiator && initiator.role !== 'ADMIN' && preCheckAccount.userId !== initiatedById) {
          // Log outside the transaction so the audit record is NEVER lost due to rollback!
          await AuditService.log({
            actorId: initiatedById,
            actorEmail: initiator.email,
            action: 'UNAUTHORIZED_TRANSFER_ATTEMPT',
            severity: 'SECURITY_ALERT',
            ipAddress: ipAddress || '127.0.0.1',
            userAgent: userAgent || 'Unknown',
            details: {
              reason: 'IDOR attempted: Source account does not belong to caller',
              fromAccountId,
              toAccountId: resolvedToAccountId,
              attemptedAmount: amount,
            },
          });
          throw new Error('Unauthorized: You do not own the source account.');
        }
      }

      // 2. Atomic Database Transaction with Strict Concurrency & Ledger Balancing
      const result = await prisma.$transaction(async (tx) => {
        // Fetch source and destination accounts inside transaction
        const fromAccount = await tx.account.findUnique({
          where: { id: fromAccountId },
          include: { user: true },
        });

        const toAccount = await tx.account.findUnique({
          where: { id: resolvedToAccountId },
          include: { user: true },
        });

        if (!fromAccount) {
          throw new Error('Source account not found.');
        }

        if (!toAccount) {
          throw new Error('Destination account not found.');
        }

        // Check account statuses
        if (fromAccount.status !== 'ACTIVE') {
          throw new Error(`Source account is ${fromAccount.status.toLowerCase()}. Transfers not permitted.`);
        }

        if (toAccount.status !== 'ACTIVE') {
          throw new Error(`Destination account is ${toAccount.status.toLowerCase()}. Transfers not permitted.`);
        }

        const initiator = await tx.user.findUnique({ where: { id: initiatedById } });
        if (!initiator) {
          throw new Error('Initiating user not found.');
        }

        if (initiator.role !== 'ADMIN' && fromAccount.userId !== initiatedById) {
          throw new Error('Unauthorized: You do not own the source account.');
        }

        // Balance check
        if (fromAccount.cachedBalance < amount) {
          throw new Error(`Insufficient funds. Available balance: $${(fromAccount.cachedBalance / 100).toFixed(2)}, Requested: $${(amount / 100).toFixed(2)}`);
        }

        // Compute resulting balances
        const newFromBalance = fromAccount.cachedBalance - amount;
        const newToBalance = toAccount.cachedBalance + amount;

        // Update source account with optimistic concurrency version increment
        await tx.account.update({
          where: { id: fromAccountId, version: fromAccount.version },
          data: {
            cachedBalance: newFromBalance,
            version: { increment: 1 },
          },
        });

        // Update destination account
        await tx.account.update({
          where: { id: resolvedToAccountId, version: toAccount.version },
          data: {
            cachedBalance: newToBalance,
            version: { increment: 1 },
          },
        });

        // Create transaction record
        const reference = generateTransactionReference();
        const transaction = await tx.transaction.create({
          data: {
            reference,
            type: 'TRANSFER',
            status: 'COMPLETED',
            description: description || `Transfer of $${(amount / 100).toFixed(2)}`,
            amount,
            currency: fromAccount.currency,
            initiatedById,
            fromAccountId,
            toAccountId: resolvedToAccountId,
          },
        });

        // Double-Entry Ledger Bookkeeping:
        // Entry 1: DEBIT source account
        const debitEntry = await tx.ledgerEntry.create({
          data: {
            transactionId: transaction.id,
            accountId: fromAccountId,
            entryType: 'DEBIT',
            amount,
            balanceAfter: newFromBalance,
          },
        });

        // Entry 2: CREDIT destination account
        const creditEntry = await tx.ledgerEntry.create({
          data: {
            transactionId: transaction.id,
            accountId: resolvedToAccountId,
            entryType: 'CREDIT',
            amount,
            balanceAfter: newToBalance,
          },
        });

        // Cryptographic Hash Chaining:
        const latestBlock = await tx.ledgerBlock.findFirst({
          orderBy: { sequenceNumber: 'desc' },
        });

        const sequenceNumber = latestBlock ? latestBlock.sequenceNumber + 1 : 1;
        const previousHash = latestBlock ? latestBlock.hash : GENESIS_PREV_HASH;
        const nonce = generateNonce();

        const hash = calculateBlockHash({
          sequenceNumber,
          previousHash,
          transactionId: transaction.id,
          reference: transaction.reference,
          amount,
          fromAccountId,
          toAccountId: resolvedToAccountId,
          timestamp: transaction.createdAt,
          nonce,
        });

        const block = await tx.ledgerBlock.create({
          data: {
            sequenceNumber,
            transactionId: transaction.id,
            previousHash,
            hash,
            nonce,
          },
        });

        // Transaction audit log inside successful commit
        await tx.auditLog.create({
          data: {
            actorId: initiatedById,
            actorEmail: initiator.email,
            action: 'TRANSFER_COMPLETED',
            severity: 'INFO',
            ipAddress: ipAddress || '127.0.0.1',
            userAgent: userAgent || 'Unknown',
            details: JSON.stringify({
              reference,
              transactionId: transaction.id,
              fromAccountId,
              toAccountId: resolvedToAccountId,
              amountCents: amount,
              amountFormatted: `$${(amount / 100).toFixed(2)}`,
              blockSequence: sequenceNumber,
              blockHash: hash,
            }),
          },
        });

        return {
          transaction,
          debitEntry,
          creditEntry,
          block,
          fromBalance: newFromBalance,
          toBalance: newToBalance,
        };
      });

      committed = true;
      return result;
    } finally {
      finalizeIdempotencyLock(lockKey, committed);
    }
  }

  /**
   * Deposits funds into an account (System credit).
   */
  static async executeDeposit(params: DepositWithdrawParams) {
    const { initiatedById, accountId, amount, description, idempotencyKey, ipAddress, userAgent } = params;

    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('Deposit amount must be a positive integer in cents.');
    }

    const preAccount = await prisma.account.findUnique({ where: { id: accountId } });
    const initiatorPre = await prisma.user.findUnique({ where: { id: initiatedById } });
    if (preAccount && initiatorPre && initiatorPre.role !== 'ADMIN' && preAccount.userId !== initiatedById) {
      await AuditService.log({
        actorId: initiatedById,
        actorEmail: initiatorPre.email,
        action: 'UNAUTHORIZED_DEPOSIT_ATTEMPT',
        severity: 'SECURITY_ALERT',
        ipAddress: ipAddress || '127.0.0.1',
        userAgent: userAgent || 'Unknown',
        details: { targetAccountId: accountId, attemptedAmount: amount },
      });
      throw new Error('Unauthorized: You do not own this account.');
    }

    const lockKey = acquireIdempotencyLock(
      idempotencyKey ? `deposit:${initiatedById}:${idempotencyKey}` : undefined
    );
    let committed = false;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const account = await tx.account.findUnique({
          where: { id: accountId },
          include: { user: true },
        });

        if (!account) throw new Error('Account not found.');
        if (account.status !== 'ACTIVE') throw new Error(`Account is ${account.status.toLowerCase()}.`);

        const initiator = await tx.user.findUnique({ where: { id: initiatedById } });
        if (!initiator) throw new Error('Initiating user not found.');
        if (initiator.role !== 'ADMIN' && account.userId !== initiatedById) {
          throw new Error('Unauthorized: You do not own this account.');
        }

        const newBalance = account.cachedBalance + amount;

        await tx.account.update({
          where: { id: accountId },
          data: {
            cachedBalance: newBalance,
            version: { increment: 1 },
          },
        });

        const reference = generateTransactionReference();
        const transaction = await tx.transaction.create({
          data: {
            reference,
            type: 'DEPOSIT',
            status: 'COMPLETED',
            description: description || `Deposit of $${(amount / 100).toFixed(2)}`,
            amount,
            currency: account.currency,
            initiatedById,
            toAccountId: accountId,
          },
        });

        const creditEntry = await tx.ledgerEntry.create({
          data: {
            transactionId: transaction.id,
            accountId,
            entryType: 'CREDIT',
            amount,
            balanceAfter: newBalance,
          },
        });

        const latestBlock = await tx.ledgerBlock.findFirst({
          orderBy: { sequenceNumber: 'desc' },
        });

        const sequenceNumber = latestBlock ? latestBlock.sequenceNumber + 1 : 1;
        const previousHash = latestBlock ? latestBlock.hash : GENESIS_PREV_HASH;
        const nonce = generateNonce();

        const hash = calculateBlockHash({
          sequenceNumber,
          previousHash,
          transactionId: transaction.id,
          reference: transaction.reference,
          amount,
          fromAccountId: null,
          toAccountId: accountId,
          timestamp: transaction.createdAt,
          nonce,
        });

        const block = await tx.ledgerBlock.create({
          data: {
            sequenceNumber,
            transactionId: transaction.id,
            previousHash,
            hash,
            nonce,
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: initiatedById,
            actorEmail: initiator.email,
            action: 'DEPOSIT_COMPLETED',
            severity: 'INFO',
            ipAddress: ipAddress || '127.0.0.1',
            userAgent: userAgent || 'Unknown',
            details: JSON.stringify({
              reference,
              accountId,
              amountCents: amount,
              newBalance,
              blockSequence: sequenceNumber,
            }),
          },
        });

        return { transaction, creditEntry, block, balance: newBalance };
      });

      committed = true;
      return result;
    } finally {
      finalizeIdempotencyLock(lockKey, committed);
    }
  }

  /**
   * Verifies the cryptographic integrity of the entire ledger chain.
   * Proves mathematically that not a single byte or transaction has been modified.
   */
  static async verifyLedgerChain(): Promise<{
    isValid: boolean;
    totalBlocks: number;
    genesisHash: string;
    latestHash: string | null;
    verifiedAt: string;
    details: string;
    tamperedBlockSequence?: number;
  }> {
    const blocks = await prisma.ledgerBlock.findMany({
      orderBy: { sequenceNumber: 'asc' },
      include: {
        transaction: true,
      },
    });

    if (blocks.length === 0) {
      return {
        isValid: true,
        totalBlocks: 0,
        genesisHash: GENESIS_PREV_HASH,
        latestHash: null,
        verifiedAt: new Date().toISOString(),
        details: 'Ledger is empty. No blocks to verify.',
      };
    }

    let expectedPrevHash = GENESIS_PREV_HASH;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const tx = block.transaction;

      // 1. Verify sequence order
      if (block.sequenceNumber !== i + 1) {
        return {
          isValid: false,
          totalBlocks: blocks.length,
          genesisHash: GENESIS_PREV_HASH,
          latestHash: blocks[blocks.length - 1].hash,
          verifiedAt: new Date().toISOString(),
          details: `Sequence number anomaly detected at block index ${i}. Expected ${i + 1}, found ${block.sequenceNumber}.`,
          tamperedBlockSequence: block.sequenceNumber,
        };
      }

      // 2. Verify previous hash link
      if (block.previousHash !== expectedPrevHash) {
        return {
          isValid: false,
          totalBlocks: blocks.length,
          genesisHash: GENESIS_PREV_HASH,
          latestHash: blocks[blocks.length - 1].hash,
          verifiedAt: new Date().toISOString(),
          details: `Broken cryptographic link at block #${block.sequenceNumber}. Stored previousHash '${block.previousHash}' does not match expected '${expectedPrevHash}'.`,
          tamperedBlockSequence: block.sequenceNumber,
        };
      }

      // 3. Re-calculate SHA-256 hash using stored transaction values
      const computedHash = calculateBlockHash({
        sequenceNumber: block.sequenceNumber,
        previousHash: block.previousHash,
        transactionId: tx.id,
        reference: tx.reference,
        amount: tx.amount,
        fromAccountId: tx.fromAccountId,
        toAccountId: tx.toAccountId,
        timestamp: tx.createdAt,
        nonce: block.nonce,
      });

      if (computedHash !== block.hash) {
        return {
          isValid: false,
          totalBlocks: blocks.length,
          genesisHash: GENESIS_PREV_HASH,
          latestHash: blocks[blocks.length - 1].hash,
          verifiedAt: new Date().toISOString(),
          details: `Data tampering detected in block #${block.sequenceNumber}! Stored hash '${block.hash}' does not match recomputed SHA-256 hash '${computedHash}'.`,
          tamperedBlockSequence: block.sequenceNumber,
        };
      }

      // Advance expected previous hash
      expectedPrevHash = block.hash;
    }

    return {
      isValid: true,
      totalBlocks: blocks.length,
      genesisHash: GENESIS_PREV_HASH,
      latestHash: blocks[blocks.length - 1].hash,
      verifiedAt: new Date().toISOString(),
      details: `Cryptographic proof verified successfully across all ${blocks.length} blocks. Zero discrepancies or tampering found.`,
    };
  }

  /**
   * Generates a cryptographic verification receipt for a specific transaction.
   */
  static async getTransactionProof(reference: string, requester?: { id: string; role: string }) {
    const tx = await prisma.transaction.findUnique({
      where: { reference },
      include: {
        entries: { include: { account: true } },
        block: true,
        initiatedBy: { select: { id: true, email: true, fullName: true } },
      },
    });

    if (!tx) throw new Error('Transaction not found');

    if (requester && requester.role === 'USER') {
      const isParticipant =
        tx.initiatedById === requester.id || tx.entries.some((e) => e.account.userId === requester.id);
      if (!isParticipant) {
        throw new Error('Unauthorized: You do not have access to this transaction proof.');
      }
    }

    const totalDebits = tx.entries
      .filter((e) => e.entryType === 'DEBIT')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalCredits = tx.entries
      .filter((e) => e.entryType === 'CREDIT')
      .reduce((sum, e) => sum + e.amount, 0);

    const isDoubleEntryBalanced =
      tx.type === 'TRANSFER' ? totalDebits === totalCredits && totalDebits === tx.amount : true;

    return {
      reference: tx.reference,
      type: tx.type,
      status: tx.status,
      amountCents: tx.amount,
      amountFormatted: `$${(tx.amount / 100).toFixed(2)}`,
      createdAt: tx.createdAt,
      initiatedBy: tx.initiatedBy,
      doubleEntry: {
        balanced: isDoubleEntryBalanced,
        totalDebitsCents: totalDebits,
        totalCreditsCents: totalCredits,
        entries: tx.entries.map((e) => ({
          accountNumber: e.account.accountNumber,
          type: e.entryType,
          amountCents: e.amount,
          balanceAfterCents: e.balanceAfter,
        })),
      },
      cryptographicProof: tx.block
        ? {
            blockSequence: tx.block.sequenceNumber,
            blockHash: tx.block.hash,
            previousHash: tx.block.previousHash,
            nonce: tx.block.nonce,
            algorithm: 'SHA-256',
          }
        : null,
    };
  }
}
