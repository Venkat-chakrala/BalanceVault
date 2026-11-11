-- PostgreSQL database-level enforcement for append-only immutable AuditLog records.
-- Allows only FK ON DELETE SET NULL for actorId while blocking any modification or deletion
-- of audit event content, timestamps, actors, or records even with direct SQL access.

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

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON "AuditLog";
CREATE TRIGGER trg_audit_log_no_update
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON "AuditLog";
CREATE TRIGGER trg_audit_log_no_delete
BEFORE DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

