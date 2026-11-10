import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma/client';
import { config } from '../config/env';
import { AuditService } from './audit.service';
import { Role } from '../types';

export interface RegisterDTO {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: Role;
  initialDepositCents?: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuthService {
  /**
   * Registers a new user and provisions their primary checking account.
   */
  static async register(dto: RegisterDTO) {
    const existing = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const initialCents = dto.initialDepositCents || 0;

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          fullName: dto.fullName.trim(),
          phone: dto.phone || null,
          role: dto.role || 'USER',
          status: 'ACTIVE',
          kycStatus: 'PENDING',
        },
      });

      // Generate random account number: BV-XXXXXX
      const randomAccNum = `BV-${Math.floor(100000 + Math.random() * 900000)}`;

      const account = await tx.account.create({
        data: {
          accountNumber: randomAccNum,
          userId: newUser.id,
          type: 'CHECKING',
          currency: 'USD',
          cachedBalance: initialCents,
          status: 'ACTIVE',
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: newUser.id,
          actorEmail: newUser.email,
          action: 'USER_REGISTERED',
          severity: 'INFO',
          ipAddress: dto.ipAddress || '127.0.0.1',
          userAgent: dto.userAgent || 'Unknown',
          details: JSON.stringify({
            userId: newUser.id,
            accountNumber: account.accountNumber,
            role: newUser.role,
            initialBalanceCents: initialCents,
          }),
        },
      });

      return { user: newUser, account };
    });

    const token = this.generateToken(user.user);

    return {
      user: {
        id: user.user.id,
        email: user.user.email,
        fullName: user.user.fullName,
        role: user.user.role,
        status: user.user.status,
        kycStatus: user.user.kycStatus,
      },
      account: {
        id: user.account.id,
        accountNumber: user.account.accountNumber,
        type: user.account.type,
        cachedBalance: user.account.cachedBalance,
        currency: user.account.currency,
      },
      token,
    };
  }

  /**
   * Authenticates user, verifies password, and checks active state.
   */
  static async login(dto: LoginDTO) {
    const user = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: { accounts: true },
    });

    if (!user) {
      await AuditService.log({
        action: 'FAILED_LOGIN_UNKNOWN_USER',
        severity: 'WARNING',
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        details: { attemptedEmail: dto.email },
      });
      throw new Error('Invalid email or password.');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      await AuditService.log({
        actorId: user.id,
        actorEmail: user.email,
        action: 'FAILED_LOGIN_BAD_PASSWORD',
        severity: 'WARNING',
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      });
      throw new Error('Invalid email or password.');
    }

    // Check account status (e.g. SUSPENDED)
    if (user.status === 'SUSPENDED') {
      await AuditService.log({
        actorId: user.id,
        actorEmail: user.email,
        action: 'SUSPENDED_LOGIN_ATTEMPT',
        severity: 'SECURITY_ALERT',
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      });
      throw new Error('Account suspended. Access denied. Contact security administrator.');
    }

    await AuditService.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'USER_LOGIN_SUCCESS',
      severity: 'INFO',
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
    });

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        kycStatus: user.kycStatus,
      },
      accounts: user.accounts.map((acc) => ({
        id: acc.id,
        accountNumber: acc.accountNumber,
        type: acc.type,
        cachedBalance: acc.cachedBalance,
        currency: acc.currency,
        status: acc.status,
      })),
      token,
    };
  }

  /**
   * Generates a signed JWT with role and tokenVersion.
   */
  static generateToken(user: { id: string; email: string; role: string; tokenVersion: number }): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      config.jwt.secret,
      { expiresIn: (config.jwt.expiresIn || '24h') as any }
    );
  }
}
