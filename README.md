# BalanceVault — Money Movement with a Ledger You Can Prove

A high-integrity account management and financial transaction platform built with server-enforced role-based access control (RBAC), double-entry ledger accounting, and cryptographic SHA-256 tamper-evident block chaining.

Developed for the **Snovasys Fresher Hiring Challenge 2026**.

---

## 🏛️ System Architecture & Ledger Mechanics

Unlike conventional web applications that update mutable balance columns (e.g. `UPDATE accounts SET balance = balance - 100`), **BalanceVault** enforces strict financial invariants:
1. **Double-Entry Bookkeeping**: Every transaction consists of balanced journal entries:
   $$\sum \text{Debits} \equiv \sum \text{Credits}$$
2. **Cryptographic Proof Chain**: Every financial event is anchored into a sequential SHA-256 block chain (`LedgerBlock`). Any direct or unauthorized row modification in the database breaks the mathematical hash chain and is immediately flagged by the verification engine.
3. **Optimistic Concurrency & Anti-Double-Spend Defense**: Transactions are executed with row-level locks and version-checked mutations, preventing race conditions even when concurrent transfers are fired simultaneously.

```
┌─────────────────┐       Initiates Transfer       ┌───────────────────────────────┐
│  Client / User  │ ─────────────────────────────> │  Auth & RBAC Middleware       │
└─────────────────┘                                └──────────────┬────────────────┘
                                                                  │ Validates JWT & Live Status
                                                                  ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   LedgerService — Atomic Database Transaction                     │
│                                                                                  │
│   1. Ownership Verification (Zero IDOR: Caller owns source account)              │
│   2. Concurrency Lock & Balance Check (balance >= amount)                        │
│   3. Double-Entry Mutation:                                                      │
│      ├── DEBIT  Source Account      (balance: $100 -> $20)                       │
│      └── CREDIT Destination Account (balance: $0   -> $80)                       │
│   4. Cryptographic Chaining:                                                     │
│      Hash_N = SHA256(Seq_N || Hash_{N-1} || TxID || Amount || Nonce)            │
│   5. Immutable Audit Log Appended                                                │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
                 ┌──────────────────────────────────────────────┐
                 │  Provable Ledger Receipt Generated           │
                 │  • Debits == Credits Proof                   │
                 │  • SHA-256 Block Hash Receipt                │
                 └──────────────────────────────────────────────┘
```

---

## 🚀 Pre-Seeded Benchmark Credentials for Evaluators

The database comes pre-seeded with synthetic test accounts ready for one-click evaluation:

| Persona | Email Address | Password | Role | Starting Balance | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Alice Martin** | `alice@balancevault.com` | `AlicePassword@123` | `USER` | **$5,000.00** | Primary customer; pre-funded for transfer testing |
| **Bob Jenkins** | `bob@balancevault.com` | `BobPassword@123` | `USER` | **$2,500.00** | Counterparty customer; test receiver |
| **Administrator** | `admin@balancevault.com` | `AdminPassword@123` | `ADMIN` | — | User management, account suspension, full ledger access |
| **Auditor** | `auditor@balancevault.com` | `AuditorPassword@123` | `AUDITOR` | — | Read-only compliance, cryptographic proof verification |
| **Charlie Vance** | `charlie@balancevault.com` | `CharliePassword@123` | `USER` | $100.00 | **SUSPENDED**; verifies immediate session rejection (403) |

---

## ⚡ Quick Start: Running on Any Machine

BalanceVault requires **Node.js (v18+)** and runs out-of-the-box with **zero external server dependencies** (SQLite self-contained ledger with zero configuration, and seamless PostgreSQL compatibility for production).

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Venkat-chakrala/BalanceVault.git
cd BalanceVault

# Install root, backend, and frontend dependencies
npm run install:all
```

### 2. Generate Prisma Client & Initialize Database
```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 3. Start Frontend & Backend Concurrently
```bash
npm run dev
```

- **Frontend Application**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000`
- **API Health Check**: `http://localhost:5000/api/health`
- **API Readiness Check**: `http://localhost:5000/api/ready`

---

## 🧪 Automated Adversarial Security Test Suite

Run the full adversarial test suite covering all 7 test categories (concurrency, IDOR, RBAC, tamper detection, negative values, and token revocation):

```bash
npm test
```

### Test Suite Output (26/26 Tests Passing):
```
PASS src/tests/concurrency.test.ts
  √ should prevent double-spending when 5 simultaneous transfer requests of $80 are fired with a $100 balance

PASS src/tests/ledger-integrity.test.ts
  √ should verify that all double-entry ledger records strictly balance (Debits == Credits)
  √ should successfully verify the valid cryptographic SHA-256 hash chain
  √ should generate a cryptographic proof receipt for a valid transaction
  √ should IMMEDIATELY detect data tampering if an attacker maliciously alters a transaction row directly in the database

PASS src/tests/idor.test.ts
  √ should block Bob from viewing Alice account balance via IDOR (403 Forbidden)
  √ should block Bob from inspecting Alice transaction history via IDOR (403 Forbidden)
  √ should block Bob from transferring money OUT of Alice account (IDOR transfer attack)
  √ should verify that an unauthorized IDOR attempt was recorded in the audit trail

PASS src/tests/rbac.test.ts
  √ should block regular USER from accessing admin user list (403 Forbidden)
  √ should block regular USER from accessing audit trail (403 Forbidden)
  √ should allow AUDITOR to access audit trail and ledger verification
  √ should block AUDITOR from modifying user accounts (admin-only route)
  √ should allow ADMIN full access to user management and system metrics

PASS src/tests/validation.test.ts
  √ should reject negative transfer amounts with 400 Bad Request
  √ should reject zero transfer amount with 400 Bad Request
  √ should reject self-transfers (fromAccount == toAccount) with 400 Bad Request
  √ should reject non-integer / floating-point cents with 400 Bad Request

PASS src/tests/revocation.test.ts
  √ should allow victim to query profile before suspension
  √ should immediately revoke the active JWT when Admin suspends the user (Zero Stale Window)

PASS src/tests/auth.test.ts
  √ should successfully register a new user with an initial checking account
  √ should reject registration if email is already taken
  √ should successfully login with valid credentials
  √ should reject login with wrong password
  √ should reject login for a SUSPENDED user account
  √ should allow authenticated user to retrieve their profile and accounts

Test Suites: 7 passed, 7 total
Tests:       26 passed, 26 total (100% Success)
```

---

## 🛡️ Security & Threat Defenses

See [`THREATS.md`](file:///c:/Users/venka/OneDrive/Desktop/BalanceVault/THREATS.md) for the exhaustive STRIDE threat model. Key mitigations include:
- **Zero IDOR**: Account mutations resolve strictly from authenticated session claims; cross-user transfers are rejected and immediately flagged to `AuditLog`.
- **Zero Stale Session Window**: Live token versioning (`tokenVersion`) immediately invalidates JWTs upon administrative user suspension.
- **Strict Integer Cents**: All monetary calculations operate on positive integer cents, eliminating floating-point rounding bugs.
- **Rate Limiting**: Express rate limiting mitigates brute force attacks against authentication and transfer routes.

---

## 📝 Prompt Engineering Log

See [`PROMPTS.md`](file:///c:/Users/venka/OneDrive/Desktop/BalanceVault/PROMPTS.md) for 5 dated entries documenting architectural prompts, AI mistakes identified (such as audit logs being dropped during transaction rollbacks and TOCTOU race conditions in balance checks), and our engineering remedies.

---

## 🌐 Production Cloud Deployment

- **Frontend**: Deployable to Vercel / Netlify / Render Static (`dist/`).
- **Backend & Database**: Deployable to Render / Railway / Supabase / Neon PostgreSQL.
  - To use PostgreSQL in production, set `DATABASE_URL=postgresql://...` and use `prisma/schema.postgresql.prisma`.

