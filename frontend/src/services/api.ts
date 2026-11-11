const API_BASE = '/api';
const TOKEN_KEY = 'bv_token';

export interface AuditTrailQuery {
  limit?: number;
  offset?: number;
  severity?: string;
  action?: string;
  search?: string;
}

export class ApiClient {
  static getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  static setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  static clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  static createIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `bv-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private static async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorCode = data?.error?.code;
      const isAuthRevoked =
        (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/register') ||
        (response.status === 403 && errorCode === 'ACCOUNT_SUSPENDED' && endpoint !== '/auth/login');

      if (isAuthRevoked) {
        this.clearToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('bv:session-revoked', {
              detail: {
                code: errorCode || 'UNAUTHORIZED',
                message: data?.error?.message || 'Your session has ended. Please sign in again.',
              },
            })
          );
        }
      }

      const err: any = new Error(data?.error?.message || 'API request failed');
      err.status = response.status;
      err.code = errorCode;
      throw err;
    }

    return data;
  }

  // Health
  static getHealth() {
    return this.request('/health');
  }

  static getReady() {
    return this.request('/ready');
  }

  // Auth & Profile
  static login(credentials: { email: string; password: string }) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  static register(payload: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    initialDepositCents?: number;
  }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static async logout() {
    try {
      return await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  }

  static getMe() {
    return this.request('/auth/me');
  }

  static updateProfile(payload: { fullName: string; phone?: string | null }) {
    return this.request('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  static submitKyc(payload: { documentType: string; documentNumber: string }) {
    return this.request('/auth/kyc/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Accounts
  static getMyAccounts() {
    return this.request('/accounts/my');
  }

  static createAccount(type: 'CHECKING' | 'SAVINGS') {
    return this.request('/accounts/open', {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  }

  static getAccountTransactions(accountId: string) {
    return this.request(`/accounts/${accountId}/transactions`);
  }

  // Transfers & Proof
  static transfer(payload: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    idempotencyKey?: string;
  }) {
    const key = payload.idempotencyKey || this.createIdempotencyKey();
    return this.request('/transfers', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify({
        fromAccountId: payload.fromAccountId,
        toAccountId: payload.toAccountId,
        amount: payload.amount,
        description: payload.description,
        idempotencyKey: key,
      }),
    });
  }

  static deposit(payload: {
    accountId: string;
    amount: number;
    description?: string;
    idempotencyKey?: string;
  }) {
    const key = payload.idempotencyKey || this.createIdempotencyKey();
    return this.request('/transfers/deposit', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify({
        accountId: payload.accountId,
        amount: payload.amount,
        description: payload.description,
        idempotencyKey: key,
      }),
    });
  }

  static getProof(reference: string) {
    return this.request(`/transfers/proof/${reference}`);
  }

  // Admin & Auditor
  static getUsers() {
    return this.request('/admin/users');
  }

  static updateUser(
    id: string,
    payload: { status?: string; role?: string; kycStatus?: string }
  ) {
    return this.request(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  static verifyLedger() {
    return this.request('/admin/ledger/verify');
  }

  static getAuditTrail(limitOrQuery: number | AuditTrailQuery = 50) {
    const query: AuditTrailQuery =
      typeof limitOrQuery === 'number' ? { limit: limitOrQuery } : limitOrQuery;
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset) params.set('offset', String(query.offset));
    if (query.severity) params.set('severity', query.severity);
    if (query.action) params.set('action', query.action);
    if (query.search) params.set('search', query.search);
    const qs = params.toString();
    return this.request(`/admin/audit-trail${qs ? `?${qs}` : ''}`);
  }

  static getStats() {
    return this.request('/admin/stats');
  }
}
