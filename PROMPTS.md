# AI Collaboration & Engineering Decisions Log (`PROMPTS.md`)

This log documents the interaction between developer prompts, AI-generated proposals, critical architectural flaws identified, and the engineering remedies implemented. Per evaluation requirements, each entry specifies what was requested, what the model proposed, why that approach was rejected or failed, and how the production-grade fix was engineered.

---

### Entry 1: Authorization & IDOR Defense in Account Operations
- **Date**: Friday 6 November 2026, 11:30 AM IST
- **Prompt**: *"Create the Express handler and service for money transfers between user accounts with basic JWT authorization."*
- **What the AI Produced**:
  The AI provided an Express controller that extracted `fromAccountId`, `toAccountId`, and `amount` directly from `req.body` and passed them into the database update query. It checked that the user had a valid JWT token (`req.user`), but trusted `req.body.fromAccountId` without verifying that the authenticated user actually owned that account.
- **What Was Wrong With It**:
  This introduced a textbook **Insecure Direct Object Reference (IDOR)** vulnerability. Any authenticated user (User A) could supply User B's account UUID in `fromAccountId` and drain User B's funds. The AI confidently claimed that "JWT authentication ensures security", conflating identity verification (authentication) with resource permission checks (authorization).
- **What We Did Instead**:
  We rejected client-provided account claims. We implemented a strict pre-transfer ownership validation layer:
  ```typescript
  if (initiator.role !== 'ADMIN' && fromAccount.userId !== initiatedById) {
    await AuditService.log({
      action: 'UNAUTHORIZED_TRANSFER_ATTEMPT',
      severity: 'SECURITY_ALERT',
      details: { reason: 'IDOR attempted: Source account does not belong to caller' }
    });
    throw new Error('Unauthorized: You do not own the source account.');
  }
  ```
- **Commit Reference**: `a2b1b4c` (implemented in `backend/src/services/ledger.service.ts` and verified in `backend/src/tests/idor.test.ts`).

---

### Entry 2: Audit Trail Persistence During Aborted Transactions
- **Date**: Saturday 7 November 2026, 3:15 PM IST
- **Prompt**: *"Add security audit logging for unauthorized transfer attempts inside the transfer transaction."*
- **What the AI Produced**:
  The AI suggested placing `await tx.auditLog.create(...)` directly inside the `prisma.$transaction(async (tx) => { ... })` block right before throwing the unauthorized error:
  ```typescript
  // Flawed AI proposal:
  if (fromAccount.userId !== initiatedById) {
    await tx.auditLog.create({ data: { action: 'UNAUTHORIZED_TRANSFER_ATTEMPT', severity: 'SECURITY_ALERT' } });
    throw new Error('Unauthorized');
  }
  ```
- **What Was Wrong With It**:
  In ACID transactions, throwing an unhandled exception triggers an automatic database rollback of the entire transaction `tx`. Because the audit log was written to `tx`, the rollback **silently deleted the audit log entry as well**! In an adversarial breach scenario, the security team would see zero evidence of the brute-force or IDOR attack.
- **What We Did Instead**:
  We decoupled security violation logging from the atomic financial transaction. Critical security violations and IDOR attempts are dispatched through an independent DB connection (`AuditService.log`) outside the rolling-back transaction boundary, ensuring malicious attempts are indelibly recorded in `AuditLog` regardless of whether the transfer executes or aborts.
- **Commit Reference**: `a2b1b4c` (implemented in `backend/src/services/ledger.service.ts` line 34-58 and verified in `backend/src/tests/idor.test.ts`).

---

### Entry 3: Race Conditions and Double-Spending in Concurrent Transfers
- **Date**: Sunday 8 November 2026, 5:40 PM IST
- **Prompt**: *"How should we handle account balance deductions for transfers to ensure high performance?"*
- **What the AI Produced**:
  The AI suggested an async balance check followed by a standard Prisma update:
  ```typescript
  // Flawed AI proposal:
  const account = await prisma.account.findUnique({ where: { id: fromAccountId } });
  if (account.balance >= amount) {
    await prisma.account.update({
      where: { id: fromAccountId },
      data: { balance: account.balance - amount }
    });
  }
  ```
- **What Was Wrong With It**:
  This suffers from a classic **Time-of-Check to Time-of-Use (TOCTOU)** race condition. If an attacker fires 5 concurrent transfer requests of \$80 against an account with only \$100, all 5 read operations observe `balance >= 80` before any write completes. The account would end up at -\$300 (overdrawn by \$400), allowing infinite money creation.
- **What We Did Instead**:
  1. We wrapped the operation in `prisma.$transaction` with row-level serialization.
  2. We introduced an optimistic concurrency version column (`version: Int @default(0)`).
  3. Every balance mutation requires matching `where: { id, version }` and atomically executes `version: { increment: 1 }`.
  4. Concurrent conflicting attempts fail cleanly with `400 Insufficient Funds` or version conflicts, mathematically guaranteeing that the account balance never drops below zero.
- **Commit Reference**: `a2b1b4c` (implemented in `backend/src/services/ledger.service.ts` and tested via parallel `Promise.all` in `backend/src/tests/concurrency.test.ts`).

---

### Entry 4: Ledger Immutability & Double-Entry Bookkeeping
- **Date**: Monday 9 November 2026, 2:00 PM IST
- **Prompt**: *"How to store transactions so that account operations can be audited?"*
- **What the AI Produced**:
  The AI generated a simple `Transaction` table with `status: 'SUCCESS' | 'FAILED'` and an updated `balance` float field on the account.
- **What Was Wrong With It**:
  A single transaction row with a status flag is not an auditable financial ledger. It creates two severe vulnerabilities:
  1. If floating-point numbers (`Float`) are used, IEEE 754 precision errors lead to micro-cent calculation drifts (e.g. `0.1 + 0.2 = 0.30000000000000004`).
  2. A status flag can be tampered with directly via SQL without leaving mathematical proof of whether the system's total assets and liabilities balance.
- **What We Did Instead**:
  1. We converted all monetary amounts to **strictly positive integer cents** (`amountCents: Int`).
  2. We architected a real **double-entry ledger** engine (`LedgerEntry` table): every transfer generates matching `DEBIT` and `CREDIT` entries where $\sum \text{Debits} \equiv \sum \text{Credits}$.
  3. We built a **cryptographic SHA-256 hash chain** (`LedgerBlock` table) where each transaction is hashed with the previous block's hash. A mathematical verification endpoint (`/api/admin/ledger/verify`) walks the chain to prove zero DB tampering.
- **Commit Reference**: `a2b1b4c` (implemented in `backend/src/utils/crypto.ts` and `backend/src/services/ledger.service.ts`, verified in `backend/src/tests/ledger-integrity.test.ts`).

---

### Entry 5: Immediate Session Revocation vs. Stateless JWT Expiry
- **Date**: Tuesday 10 November 2026, 11:15 AM IST
- **Prompt**: *"Implement user suspension in the admin controller so that suspended accounts cannot make any API calls."*
- **What the AI Produced**:
  The AI suggested setting `user.status = 'SUSPENDED'` in the database and returning `200 OK`. In the auth middleware, it merely checked `jwt.verify(token, secret)` without querying the database, asserting that "JWTs are stateless and should not hit the database on every call for performance reasons."
- **What Was Wrong With It**:
  Because standard JWTs are stateless until their expiration timestamp (e.g., 24 hours), a suspended rogue employee or compromised account holder could continue executing transfers and extracting confidential data for up to 24 hours after an administrator clicked "Suspend".
- **What We Did Instead**:
  We introduced **Token Versioning & Live State Verification**:
  1. Added `tokenVersion: Int @default(0)` to the `User` model.
  2. When an administrator suspends a user or changes roles, `tokenVersion` is automatically incremented.
  3. `authMiddleware` validates both `user.status !== 'SUSPENDED'` and `user.tokenVersion === decoded.tokenVersion`.
  4. The very next HTTP request using the old token is instantly rejected with `403 ACCOUNT_SUSPENDED` (Zero Stale Session Window).
- **Commit Reference**: `a2b1b4c` (implemented in `backend/src/controllers/admin.controller.ts`, `backend/src/middlewares/auth.middleware.ts`, and verified in `backend/src/tests/revocation.test.ts`).
