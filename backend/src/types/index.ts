export type Role = 'USER' | 'ADMIN' | 'AUDITOR';
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED';
export type KycStatus = 'UNSUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type AccountType = 'CHECKING' | 'SAVINGS' | 'SYSTEM_VAULT';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'SYSTEM_CREDIT';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
export type EntryType = 'DEBIT' | 'CREDIT';
export type AuditSeverity = 'INFO' | 'WARNING' | 'SECURITY_ALERT' | 'CRITICAL';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
