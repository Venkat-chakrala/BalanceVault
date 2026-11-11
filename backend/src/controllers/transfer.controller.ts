import { Request, Response, NextFunction } from 'express';
import { LedgerService } from '../services/ledger.service';

export class TransferController {
  /**
   * Executes money transfer with double-entry ledger bookkeeping.
   */
  static async transfer(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromAccountId, toAccountId, amount, description, idempotencyKey } = req.body;
      const headerIdempotencyKey = req.header('idempotency-key') || undefined;
      const user = req.user!;

      const result = await LedgerService.executeTransfer({
        initiatedById: user.id,
        fromAccountId,
        toAccountId,
        amount,
        description,
        idempotencyKey: idempotencyKey || headerIdempotencyKey,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(200).json({
        success: true,
        message: 'Transfer successfully processed and cryptographically anchored in ledger.',
        data: {
          transactionReference: result.transaction.reference,
          amountCents: result.transaction.amount,
          amountFormatted: `$${(result.transaction.amount / 100).toFixed(2)}`,
          newSourceBalanceFormatted: `$${(result.fromBalance / 100).toFixed(2)}`,
          blockSequence: result.block.sequenceNumber,
          blockHash: result.block.hash,
          createdAt: result.transaction.createdAt,
        },
      });
    } catch (error: any) {
      const isAuthError = error.message.includes('Unauthorized') || error.message.includes('not own');
      const isDuplicate = error.message.includes('Duplicate transaction');
      const status = isAuthError ? 403 : isDuplicate ? 409 : 400;

      return res.status(status).json({
        success: false,
        error: {
          code: isAuthError ? 'UNAUTHORIZED' : isDuplicate ? 'DUPLICATE_TRANSACTION' : 'TRANSFER_FAILED',
          message: error.message,
        },
      });
    }
  }

  /**
   * Simulates synthetic deposit (for demo / testing funds).
   */
  static async deposit(req: Request, res: Response, next: NextFunction) {
    try {
      const { accountId, amount, description, idempotencyKey } = req.body;
      const headerIdempotencyKey = req.header('idempotency-key') || undefined;
      const user = req.user!;

      const result = await LedgerService.executeDeposit({
        initiatedById: user.id,
        accountId,
        amount,
        description,
        idempotencyKey: idempotencyKey || headerIdempotencyKey,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(200).json({
        success: true,
        message: 'Deposit successfully added and credited.',
        data: {
          transactionReference: result.transaction.reference,
          amountFormatted: `$${(amount / 100).toFixed(2)}`,
          newBalanceFormatted: `$${(result.balance / 100).toFixed(2)}`,
          blockSequence: result.block.sequenceNumber,
          blockHash: result.block.hash,
        },
      });
    } catch (error: any) {
      const isAuthError = error.message.includes('Unauthorized') || error.message.includes('not own');
      const isDuplicate = error.message.includes('Duplicate transaction');
      const status = isAuthError ? 403 : isDuplicate ? 409 : 400;
      return res.status(status).json({
        success: false,
        error: {
          code: isAuthError ? 'UNAUTHORIZED' : isDuplicate ? 'DUPLICATE_TRANSACTION' : 'DEPOSIT_FAILED',
          message: error.message,
        },
      });
    }
  }

  /**
   * Retrieves a verifiable cryptographic receipt for any transaction.
   */
  static async getProof(req: Request, res: Response, next: NextFunction) {
    try {
      const { reference } = req.params;
      const proof = await LedgerService.getTransactionProof(reference, req.user);

      return res.status(200).json({
        success: true,
        data: proof,
      });
    } catch (error: any) {
      const isAuthError = error.message.includes('Unauthorized');
      return res.status(isAuthError ? 403 : 404).json({
        success: false,
        error: { code: isAuthError ? 'FORBIDDEN' : 'NOT_FOUND', message: error.message },
      });
    }
  }
}

