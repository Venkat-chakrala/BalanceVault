import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { AuditService } from '../services/audit.service';

export class AccountController {
  /**
   * Retrieves all accounts owned by the currently authenticated user.
   */
  static async getMyAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const accounts = await prisma.account.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      return res.status(200).json({
        success: true,
        data: accounts.map((acc) => ({
          id: acc.id,
          accountNumber: acc.accountNumber,
          type: acc.type,
          cachedBalanceCents: acc.cachedBalance,
          cachedBalanceFormatted: `$${(acc.cachedBalance / 100).toFixed(2)}`,
          currency: acc.currency,
          status: acc.status,
          createdAt: acc.createdAt,
        })),
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Retrieves a single account by ID with strict IDOR prevention.
   */
  static async getAccountById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = req.user!;

      const account = await prisma.account.findUnique({
        where: { id },
        include: { user: { select: { id: true, email: true, fullName: true } } },
      });

      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Account not found.' },
        });
      }

      // IDOR Defense: Ensure caller owns the account unless ADMIN or AUDITOR
      if (user.role === 'USER' && account.userId !== user.id) {
        await AuditService.log({
          actorId: user.id,
          actorEmail: user.email,
          action: 'IDOR_ACCOUNT_INSPECTION_ATTEMPT',
          severity: 'SECURITY_ALERT',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          details: { targetAccountId: id, actualOwnerId: account.userId },
        });

        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied. You do not own this account.' },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          id: account.id,
          accountNumber: account.accountNumber,
          type: account.type,
          cachedBalanceCents: account.cachedBalance,
          cachedBalanceFormatted: `$${(account.cachedBalance / 100).toFixed(2)}`,
          currency: account.currency,
          status: account.status,
          owner: account.user,
          createdAt: account.createdAt,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Retrieves transaction history and ledger entries for an account.
   */
  static async getAccountTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = req.user!;

      const account = await prisma.account.findUnique({ where: { id } });
      if (!account) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Account not found.' },
        });
      }

      // IDOR Defense
      if (user.role === 'USER' && account.userId !== user.id) {
        await AuditService.log({
          actorId: user.id,
          actorEmail: user.email,
          action: 'IDOR_TRANSACTION_HISTORY_ATTEMPT',
          severity: 'SECURITY_ALERT',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          details: { targetAccountId: id },
        });

        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied. You do not own this account.' },
        });
      }

      const entries = await prisma.ledgerEntry.findMany({
        where: { accountId: id },
        include: {
          transaction: {
            include: {
              block: true,
              fromAccount: { select: { accountNumber: true } },
              toAccount: { select: { accountNumber: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return res.status(200).json({
        success: true,
        data: entries.map((entry) => ({
          entryId: entry.id,
          transactionId: entry.transactionId,
          reference: entry.transaction.reference,
          type: entry.transaction.type,
          entryType: entry.entryType, // DEBIT or CREDIT
          amountCents: entry.amount,
          amountFormatted: `$${(entry.amount / 100).toFixed(2)}`,
          balanceAfterCents: entry.balanceAfter,
          balanceAfterFormatted: `$${(entry.balanceAfter / 100).toFixed(2)}`,
          description: entry.transaction.description,
          counterpartyAccount:
            entry.entryType === 'DEBIT'
              ? entry.transaction.toAccount?.accountNumber || 'SYSTEM'
              : entry.transaction.fromAccount?.accountNumber || 'SYSTEM',
          cryptographicHash: entry.transaction.block?.hash || null,
          createdAt: entry.createdAt,
        })),
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Opens a new secondary account (e.g. SAVINGS).
   */
  static async createAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { type } = req.body;

      const randomAccNum = `BV-${Math.floor(100000 + Math.random() * 900000)}`;

      const newAccount = await prisma.account.create({
        data: {
          accountNumber: randomAccNum,
          userId,
          type: type === 'SAVINGS' ? 'SAVINGS' : 'CHECKING',
          currency: 'USD',
          cachedBalance: 0,
          status: 'ACTIVE',
        },
      });

      await AuditService.log({
        actorId: userId,
        actorEmail: req.user!.email,
        action: 'ACCOUNT_CREATED',
        severity: 'INFO',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { accountNumber: newAccount.accountNumber, type: newAccount.type },
      });

      return res.status(201).json({
        success: true,
        message: 'Account successfully opened.',
        data: newAccount,
      });
    } catch (error) {
      return next(error);
    }
  }
}

