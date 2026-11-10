import { Request, Response, NextFunction } from 'express';
import { LedgerService } from '../services/ledger.service';

export class TransferController {
  /**
   * Executes money transfer with double-entry ledger bookkeeping.
   */
  static async transfer(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromAccountId, toAccountId, amount, description } = req.body;
      const user = req.user!;

      const result = await LedgerService.executeTransfer({
        initiatedById: user.id,
        fromAccountId,
        toAccountId,
        amount,
        description,
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
      const status = isAuthError ? 403 : error.message.includes('Insufficient') ? 400 : 400;

      return res.status(status).json({
        success: false,
        error: {
          code: isAuthError ? 'UNAUTHORIZED' : 'TRANSFER_FAILED',
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
      const { accountId, amount, description } = req.body;
      const user = req.user!;

      const result = await LedgerService.executeDeposit({
        initiatedById: user.id,
        accountId,
        amount,
        description,
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
      return res.status(400).json({
        success: false,
        error: { code: 'DEPOSIT_FAILED', message: error.message },
      });
    }
  }

  /**
   * Retrieves a verifiable cryptographic receipt for any transaction.
   */
  static async getProof(req: Request, res: Response, next: NextFunction) {
    try {
      const { reference } = req.params;
      const proof = await LedgerService.getTransactionProof(reference);

      return res.status(200).json({
        success: true,
        data: proof,
      });
    } catch (error: any) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: error.message },
      });
    }
  }
}
