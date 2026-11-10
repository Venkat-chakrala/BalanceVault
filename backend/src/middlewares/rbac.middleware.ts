import { Request, Response, NextFunction } from 'express';
import { Role } from '../types';
import { AuditService } from '../services/audit.service';

/**
 * Higher-order middleware enforcing strict server-side Role-Based Access Control (RBAC).
 * Automatically logs unauthorized escalation attempts to the audit trail.
 */
export function requireRole(allowedRoles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required prior to permission evaluation.',
        },
      });
    }

    if (!allowedRoles.includes(user.role)) {
      // Security Incident: Log privilege escalation attempt
      await AuditService.log({
        actorId: user.id,
        actorEmail: user.email,
        action: 'PRIVILEGE_ESCALATION_ATTEMPT',
        severity: 'SECURITY_ALERT',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: {
          path: req.originalUrl,
          method: req.method,
          userRole: user.role,
          requiredRoles: allowedRoles,
        },
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Endpoint requires one of the following roles: [${allowedRoles.join(', ')}].`,
        },
      });
    }

    return next();
  };
}
