import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import prisma from '../prisma/client';
import { AuditService } from '../services/audit.service';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.register({
        ...req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(201).json({
        success: true,
        message: 'Registration successful. Account provisioned.',
        data: result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: { code: 'REGISTRATION_FAILED', message: error.message },
      });
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.login({
        ...req.body,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        data: result,
      });
    } catch (error: any) {
      const status = error.message.includes('suspended') ? 403 : 401;
      return res.status(status).json({
        success: false,
        error: { code: 'AUTH_FAILED', message: error.message },
      });
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { accounts: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User record not found.' },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            phone: user.phone,
            role: user.role,
            status: user.status,
            kycStatus: user.kycStatus,
            kycDocumentType: user.kycDocumentType,
            kycDocumentNumber: user.kycDocumentNumber,
            createdAt: user.createdAt,
          },
          accounts: user.accounts.map((acc) => ({
            id: acc.id,
            accountNumber: acc.accountNumber,
            type: acc.type,
            cachedBalanceCents: acc.cachedBalance,
            cachedBalanceFormatted: `$${(acc.cachedBalance / 100).toFixed(2)}`,
            currency: acc.currency,
            status: acc.status,
            version: acc.version,
          })),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async submitKyc(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { documentType, documentNumber } = req.body;

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          kycStatus: 'PENDING',
          kycDocumentType: documentType,
          kycDocumentNumber: documentNumber,
        },
      });

      await AuditService.log({
        actorId: userId,
        actorEmail: updated.email,
        action: 'KYC_DOCUMENTS_SUBMITTED',
        severity: 'INFO',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: { documentType, documentNumberMasked: `***${documentNumber.slice(-4)}` },
      });

      return res.status(200).json({
        success: true,
        message: 'KYC documentation submitted for verification.',
        data: {
          kycStatus: updated.kycStatus,
          kycDocumentType: updated.kycDocumentType,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}
