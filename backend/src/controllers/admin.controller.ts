import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { LedgerService } from '../services/ledger.service';
import { AuditService } from '../services/audit.service';

export class AdminController {
  /**
   * Lists all registered users and their account statuses.
   */
  static async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            status: true,
            kycStatus: true,
            tokenVersion: true,
            createdAt: true,
            accounts: {
              select: {
                id: true,
                accountNumber: true,
                type: true,
                cachedBalance: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.user.count(),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          total,
          page,
          limit,
          users: users.map((u) => ({
            ...u,
            totalBalanceCents: u.accounts.reduce((sum, a) => sum + a.cachedBalance, 0),
            totalBalanceFormatted: `$${(u.accounts.reduce((sum, a) => sum + a.cachedBalance, 0) / 100).toFixed(2)}`,
          })),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Updates user status, role, or KYC verification.
   * Increments tokenVersion on suspension or role change to force immediate session revocation!
   */
  static async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, role, kycStatus } = req.body;
      const admin = req.user!;

      const target = await prisma.user.findUnique({ where: { id } });
      if (!target) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found.' },
        });
      }

      // Security Check: Prevent admin self-lockout
      if (admin.id === id && status === 'SUSPENDED') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_ACTION', message: 'Administrators cannot suspend their own account.' },
        });
      }

      const isSecuritySensitiveChange =
        (status && status !== target.status) || (role && role !== target.role);

      const updated = await prisma.user.update({
        where: { id },
        data: {
          ...(status ? { status } : {}),
          ...(role ? { role } : {}),
          ...(kycStatus ? { kycStatus } : {}),
          // Increment tokenVersion to immediately revoke any active JWT sessions
          ...(isSecuritySensitiveChange ? { tokenVersion: { increment: 1 } } : {}),
        },
      });

      // Also freeze user accounts if suspended
      if (status === 'SUSPENDED') {
        await prisma.account.updateMany({
          where: { userId: id },
          data: { status: 'FROZEN' },
        });
      } else if (status === 'ACTIVE' && target.status === 'SUSPENDED') {
        await prisma.account.updateMany({
          where: { userId: id },
          data: { status: 'ACTIVE' },
        });
      }

      await AuditService.log({
        actorId: admin.id,
        actorEmail: admin.email,
        action: 'ADMIN_USER_MODIFIED',
        severity: status === 'SUSPENDED' ? 'WARNING' : 'INFO',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          targetUserId: id,
          targetEmail: target.email,
          previousStatus: target.status,
          newStatus: status || target.status,
          previousRole: target.role,
          newRole: role || target.role,
          tokenVersionIncremented: isSecuritySensitiveChange,
        },
      });

      return res.status(200).json({
        success: true,
        message: `User record updated. Token version bumped: ${isSecuritySensitiveChange}.`,
        data: {
          id: updated.id,
          email: updated.email,
          status: updated.status,
          role: updated.role,
          kycStatus: updated.kycStatus,
          tokenVersion: updated.tokenVersion,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Verifies the cryptographic integrity of the entire ledger.
   * Can be invoked by ADMIN or AUDITOR.
   */
  static async verifyLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const verification = await LedgerService.verifyLedgerChain();

      await AuditService.log({
        actorId: req.user?.id,
        actorEmail: req.user?.email,
        action: 'LEDGER_INTEGRITY_VERIFICATION_PERFORMED',
        severity: verification.isValid ? 'INFO' : 'CRITICAL',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: verification,
      });

      return res.status(200).json({
        success: true,
        data: verification,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Returns system audit logs with optional filters.
   */
  static async getAuditTrail(req: Request, res: Response, next: NextFunction) {
    try {
      const { actorId, action, severity, search, limit, offset } = req.query;

      const result = await AuditService.getLogs({
        actorId: actorId as string,
        action: action as string,
        severity: severity as string,
        search: search as string,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * High-level system health, ledger metrics, and monetary statistics.
   */
  static async getSystemStats(req: Request, res: Response, next: NextFunction) {
    try {
      const [userCount, accountCount, totalVolumeResult, blockCount] = await Promise.all([
        prisma.user.count(),
        prisma.account.count(),
        prisma.account.aggregate({
          _sum: { cachedBalance: true },
        }),
        prisma.ledgerBlock.count(),
      ]);

      const totalBalanceCents = totalVolumeResult._sum.cachedBalance || 0;

      return res.status(200).json({
        success: true,
        data: {
          totalUsers: userCount,
          totalAccounts: accountCount,
          totalVaultBalanceCents: totalBalanceCents,
          totalVaultBalanceFormatted: `$${(totalBalanceCents / 100).toFixed(2)}`,
          totalLedgerBlocks: blockCount,
          uptimeSeconds: Math.floor(process.uptime()),
          nodeVersion: process.version,
          status: 'HEALTHY',
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}

