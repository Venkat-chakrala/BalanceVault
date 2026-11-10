import prisma from '../prisma/client';
import { AuditSeverity } from '../types';

export interface CreateAuditLogParams {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  severity?: AuditSeverity;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export class AuditService {
  /**
   * Appends an immutable audit record to the system trail.
   */
  static async log(params: CreateAuditLogParams): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: params.actorId || null,
          actorEmail: params.actorEmail || null,
          action: params.action,
          severity: params.severity || 'INFO',
          ipAddress: params.ipAddress || '127.0.0.1',
          userAgent: params.userAgent || 'Unknown',
          details: JSON.stringify(params.details || {}),
        },
      });
    } catch (error) {
      // Audit logging failure should not crash the transaction, but must be printed to stderr
      console.error('[AUDIT_LOG_FAILURE]', error, params);
    }
  }

  /**
   * Retrieves audit logs with optional filtering.
   */
  static async getLogs(filters: {
    actorId?: string;
    action?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    const where: any = {};
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.action) where.action = { contains: filters.action };
    if (filters.severity) where.severity = filters.severity;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      total,
      limit,
      offset,
      logs: logs.map((log) => ({
        ...log,
        details: (() => {
          try {
            return JSON.parse(log.details);
          } catch {
            return log.details;
          }
        })(),
      })),
    };
  }
}
