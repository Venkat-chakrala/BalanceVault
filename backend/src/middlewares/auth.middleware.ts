import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import prisma from '../prisma/client';
import { AuthenticatedUser } from '../types';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  tokenVersion: number;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token missing or invalid format. Please log in.',
        },
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch (err: any) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Session token has expired or is invalid.',
        },
      });
    }

    // Live Database Verification for Instant Revocation Check
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The account associated with this token no longer exists.',
        },
      });
    }

    // Immediate Revocation Rule: Check status
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended by an administrator. All active sessions revoked.',
        },
      });
    }

    // Immediate Revocation Rule: Check token version
    if (user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REVOKED',
          message: 'Your session has been invalidated due to a security update. Please log in again.',
        },
      });
    }

    req.user = user as AuthenticatedUser;
    return next();
  } catch (error) {
    return next(error);
  }
}
