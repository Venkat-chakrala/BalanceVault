import { PrismaClient } from '@prisma/client';

const baseClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

function createImmutablePrismaClient(client: PrismaClient) {
  return client.$extends({
    query: {
      auditLog: {
        async update() {
          throw new Error('IMMUTABLE_AUDIT_LOG: Audit records are strictly append-only and cannot be modified.');
        },
        async updateMany() {
          throw new Error('IMMUTABLE_AUDIT_LOG: Audit records are strictly append-only and cannot be modified.');
        },
        async upsert() {
          throw new Error('IMMUTABLE_AUDIT_LOG: Audit records are strictly append-only and cannot be modified.');
        },
        async delete() {
          throw new Error('IMMUTABLE_AUDIT_LOG: Audit records are strictly append-only and cannot be deleted.');
        },
        async deleteMany() {
          throw new Error('IMMUTABLE_AUDIT_LOG: Audit records are strictly append-only and cannot be deleted.');
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof createImmutablePrismaClient>;

declare global {
  var prisma: ExtendedPrismaClient | undefined;
}

export const prisma: ExtendedPrismaClient =
  global.prisma || createImmutablePrismaClient(baseClient);

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Installs database-engine triggers on "AuditLog" so audit records cannot be altered
 * or deleted even via direct SQL statements bypassing the application layer.
 */
export async function ensureAuditImmutabilityTriggers(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || '';
  const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

  if (isPostgres) {
    await baseClient.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
      RETURNS trigger AS $$
      BEGIN
        IF TG_OP = 'UPDATE'
          AND NEW."actorId" IS NULL
          AND NEW."actorEmail" IS NOT DISTINCT FROM OLD."actorEmail"
          AND NEW."action" = OLD."action"
          AND NEW."severity" = OLD."severity"
          AND NEW."ipAddress" = OLD."ipAddress"
          AND NEW."userAgent" = OLD."userAgent"
          AND NEW."details" = OLD."details"
          AND NEW."createdAt" = OLD."createdAt"
        THEN
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'IMMUTABLE_AUDIT_LOG: Audit records are strictly append-only and cannot be modified or deleted';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await baseClient.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS trg_audit_log_no_update ON "AuditLog";
    `);
    await baseClient.$executeRawUnsafe(`
      CREATE TRIGGER trg_audit_log_no_update
      BEFORE UPDATE ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
    `);
    await baseClient.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON "AuditLog";
    `);
    await baseClient.$executeRawUnsafe(`
      CREATE TRIGGER trg_audit_log_no_delete
      BEFORE DELETE ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
    `);
    return;
  }

  // SQLite engine triggers (allows only FK ON DELETE SET NULL on actorId while locking all audit fields)
  await baseClient.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS prevent_audit_log_update
    BEFORE UPDATE ON "AuditLog"
    WHEN NOT (
      NEW."actorId" IS NULL
      AND (NEW."actorEmail" IS OLD."actorEmail")
      AND NEW."action" = OLD."action"
      AND NEW."severity" = OLD."severity"
      AND NEW."ipAddress" = OLD."ipAddress"
      AND NEW."userAgent" = OLD."userAgent"
      AND NEW."details" = OLD."details"
      AND NEW."createdAt" = OLD."createdAt"
    )
    BEGIN
      SELECT RAISE(ABORT, 'IMMUTABLE_AUDIT_LOG: Audit records are strictly append-only and cannot be modified');
    END;
  `);

  await baseClient.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS prevent_audit_log_delete
    BEFORE DELETE ON "AuditLog"
    BEGIN
      SELECT RAISE(ABORT, 'IMMUTABLE_AUDIT_LOG: Audit records are strictly append-only and cannot be deleted');
    END;
  `);
}

export default prisma;
