# BalanceVault — Threat Model & Security Architecture (`THREATS.md`)

This document defines the formal Threat Model for **BalanceVault** using the industry-standard **STRIDE** methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege). It maps every anticipated adversarial attack vector to our concrete engineering defenses and automated verification test suites.

---

## 1. Threat Matrix & Defense Mapping

| Threat ID | Category | Threat Vector & Description | Severity | Mitigation in BalanceVault | Automated Test File |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **THREAT-01** | **Elevation of Privilege** | **Broken Access Control (Vertical)**: Regular user calls `/api/admin/*` or `/api/admin/audit-trail` to view/modify system state. | **CRITICAL** | Server-side `requireRole(['ADMIN'])` and `requireRole(['AUDITOR'])` middleware validates authenticated JWT claims and live database user role on every request. Unauthorized attempts immediately trigger `SECURITY_ALERT` audit logs. | `backend/src/tests/rbac.test.ts` |
| **THREAT-02** | **Elevation of Privilege** | **Horizontal Privilege Escalation (IDOR)**: User A attempts to view, inspect, or transfer money out of User B's account by guessing or substituting UUIDs. | **CRITICAL** | Strict ownership validation in `AccountController` and `LedgerService`. Every account operation checks `account.userId === req.user.id`. IDOR transfer attempts are rejected and immediately flagged. | `backend/src/tests/idor.test.ts` |
| **THREAT-03** | **Tampering** | **Double-Spending & Race Conditions**: Adversary fires simultaneous concurrent transfer requests to spend more funds than the available account balance. | **CRITICAL** | ACID database transactions (`prisma.$transaction`) with strict balance pre-checks and optimistic concurrency version locking (`version = version + 1`). Parallel requests are serialized; only requests with sufficient balance succeed. | `backend/src/tests/concurrency.test.ts` |
| **THREAT-04** | **Tampering** | **Negative, Fractional, or Zero-Value Transfers**: Adversary injects negative numbers (`amount: -500`) to falsely credit accounts or non-integer floating-point values. | **HIGH** | Strict runtime schema validation via Zod (`z.number().int().positive()`) coupled with integer-cent storage (eliminates IEEE 754 precision drift). Self-transfers (`from == to`) are blocked. | `backend/src/tests/validation.test.ts` |
| **THREAT-05** | **Tampering** | **Direct Database Modification / Ledger Tampering**: Malicious insider or compromised DB credential attempts to modify transaction rows directly in SQL. | **CRITICAL** | Cryptographic SHA-256 block chaining (`LedgerBlock`). Every transaction is hashed with previous block hash, nonce, timestamps, amounts, and accounts. A tamper verification engine recalculates the hash chain and flags any modified row instantly. | `backend/src/tests/ledger-integrity.test.ts` |
| **THREAT-06** | **Spoofing** | **Delayed Session Revocation / Stale Tokens**: Suspended or terminated user attempts to use a pre-existing valid JWT during its expiry window. | **HIGH** | Database-backed live session validation via `user.status === 'SUSPENDED'` and `user.tokenVersion`. Admin suspension increments `tokenVersion`, invalidating all active tokens immediately (zero stale session window). | `backend/src/tests/revocation.test.ts` |
| **THREAT-07** | **Repudiation** | **Unprovable Transactions & Missing Accountability**: User or administrator denies initiating an action or modifying account status. | **HIGH** | Double-entry journal entries (`LedgerEntry`) enforcing `Debits == Credits` for every movement of money, verifiable cryptographic receipts, and an append-only `AuditLog` table capturing actor ID, email, IP address, user-agent, and action metadata. | `backend/src/tests/ledger-integrity.test.ts` |
| **THREAT-08** | **Denial of Service** | **Brute Force & Rate Limit Flooding**: Adversary floods authentication or money transfer endpoints to cause denial of service or credential stuffing. | **MEDIUM** | Rate limiting middleware (`express-rate-limit`) enforcing 200 requests/15m globally, and sensitive throttling (30 requests/min) on auth and transfer routes. Payload size caps (`10kb`) prevent memory exhaustion. | `backend/src/middlewares/rateLimiter.middleware.ts` |

---

## 2. Deep Dive: Architectural Defenses

### A. The Double-Entry Ledger Engine ("A Ledger You Can Prove")
In legacy or poorly designed fintech prototypes, money movement is often modeled via naive balance updates:
```sql
-- DANGEROUS: Susceptible to race conditions, partial failures, and non-provable balances
UPDATE accounts SET balance = balance - 100 WHERE id = 'A';
UPDATE accounts SET balance = balance + 100 WHERE id = 'B';
```
In **BalanceVault**, every financial movement is governed by formal double-entry accounting:
1. Every transfer produces a parent `Transaction` and at least two balanced `LedgerEntry` records (a `DEBIT` and a `CREDIT`).
2. The core invariant:
   $$\sum \text{Debits} \equiv \sum \text{Credits}$$
3. An account balance is deterministically verifiable from the chronological sum of all its ledger entries.

### B. Cryptographic SHA-256 Hash Chaining
To prevent unauthorized out-of-band ledger tampering (e.g., direct SQL updates), each transaction is committed into a cryptographic block:
- **Block $N$ Hash**:
  $$\text{Hash}_N = \text{SHA256}(\text{Seq}_N \parallel \text{Hash}_{N-1} \parallel \text{TxID} \parallel \text{Ref} \parallel \text{Amount} \parallel \text{From} \parallel \text{To} \parallel \text{Timestamp} \parallel \text{Nonce})$$
- **Verification Engine**: The `/api/admin/ledger/verify` endpoint walks the entire chain from the Genesis block (`0000...0000`) through block $N$, re-computing SHA-256 hashes against actual database transaction fields.
- If an adversary updates a single transaction row in the database, the hash of that block and every subsequent link breaks immediately, identifying the exact tampered sequence number.

### C. Concurrency & Double-Spend Defense
When multiple transfer requests arrive concurrently (e.g. 5 parallel transfers of \$80 from an account with only \$100):
1. Both accounts are locked and evaluated within an atomic transaction.
2. The balance check `if (fromAccount.cachedBalance < amount)` evaluates the real-time balance.
3. Optimistic concurrency locking (`where: { id, version }`) increments the account version on update.
4. If a concurrent transaction modified the account during evaluation, the version check rejects the conflicting transaction, preventing overdrafts and race conditions.

---

## 3. Automated Test Verification Summary

All threats documented above are continuously verified by our automated Jest test suite located in `backend/src/tests/`:

```
PASS src/tests/validation.test.ts (Input Validation & Boundary Defense)
  √ should reject negative transfer amounts with 400 Bad Request
  √ should reject zero transfer amount with 400 Bad Request
  √ should reject self-transfers (fromAccount == toAccount) with 400 Bad Request
  √ should reject non-integer / floating-point cents with 400 Bad Request

PASS src/tests/concurrency.test.ts (Concurrency & Anti-Double-Spend Defense)
  √ should prevent double-spending when 5 simultaneous transfer requests of $80 are fired with a $100 balance

PASS src/tests/revocation.test.ts (Immediate Session Revocation Defense)
  √ should allow victim to query profile before suspension
  √ should immediately revoke the active JWT when Admin suspends the user (Zero Stale Window)

PASS src/tests/ledger-integrity.test.ts (Verifiable Ledger & Cryptographic Integrity)
  √ should verify that all double-entry ledger records strictly balance (Debits == Credits)
  √ should successfully verify the valid cryptographic SHA-256 hash chain
  √ should generate a cryptographic proof receipt for a valid transaction
  √ should IMMEDIATELY detect data tampering if an attacker maliciously alters a transaction row directly in the database

PASS src/tests/idor.test.ts (Insecure Direct Object Reference Defense)
  √ should block Bob from viewing Alice account balance via IDOR (403 Forbidden)
  √ should block Bob from inspecting Alice transaction history via IDOR (403 Forbidden)
  √ should block Bob from transferring money OUT of Alice account (IDOR transfer attack)
  √ should verify that an unauthorized IDOR attempt was recorded in the audit trail

PASS src/tests/rbac.test.ts (Role-Based Access Control Defense)
  √ should block regular USER from accessing admin user list (403 Forbidden)
  √ should block regular USER from accessing audit trail (403 Forbidden)
  √ should allow AUDITOR to access audit trail and ledger verification
  √ should block AUDITOR from modifying user accounts (admin-only route)
  √ should allow ADMIN full access to user management and system metrics

PASS src/tests/auth.test.ts (Authentication & Onboarding)
  √ should successfully register a new user with an initial checking account
  √ should reject registration if email is already taken
  √ should successfully login with valid credentials
  √ should reject login with wrong password
  √ should reject login for a SUSPENDED user account
  √ should allow authenticated user to retrieve their profile and accounts

Total: 7 Test Suites Passed, 26 Adversarial Tests Passed (100% Success)
```
