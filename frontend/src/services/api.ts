const API_BASE = '/api';

export class ApiClient {
  private static getToken(): string | null {
    return localStorage.getItem('bv_token');
  }

  public static setToken(token: string) {
    localStorage.setItem('bv_token', token);
  }

  public static clearToken() {
    localStorage.removeItem('bv_token');
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || (response.status === 403 && data.error?.code === 'ACCOUNT_SUSPENDED')) {
        // Handle immediate session revocation
        if (data.error?.code === 'TOKEN_REVOKED' || data.error?.code === 'ACCOUNT_SUSPENDED') {
          // Token is dead
        }
      }
      throw new Error(data.error?.message || 'API request failed');
    }

    return data;
  }

  // Health
  static getHealth() {
    return this.request<{ status: string; uptime: number; service: string }>('/health');
  }

  static getReady() {
    return this.request<{ status: string; checks: { database: string; ledgerService: string } }>('/ready');
  }

  // Auth
  static login(credentials: { email: string; password: string }) {
    return this.request<{ success: boolean; data: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  static register(payload: { email: string; password: string; fullName: string; initialDepositCents?: number }) {
    return this.request<{ success: boolean; data: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static getMe() {
    return this.request<{ success: boolean; data: any }>('/auth/me');
  }

  static submitKyc(payload: { documentType: string; documentNumber: string }) {
    return this.request<{ success: boolean; data: any }>('/auth/kyc/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Accounts
  static getMyAccounts() {
    return this.request<{ success: boolean; data: any[] }>('/accounts/my');
  }

  static getAccountTransactions(accountId: string) {
    return this.request<{ success: boolean; data: any[] }>(`/accounts/${accountId}/transactions`);
  }

  // Transfers & Ledger
  static transfer(payload: { fromAccountId: string; toAccountId: string; amount: number; description?: string }) {
    return this.request<{ success: boolean; message: string; data: any }>('/transfers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static deposit(payload: { accountId: string; amount: number; description?: string }) {
    return this.request<{ success: boolean; message: string; data: any }>('/transfers/deposit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static getProof(reference: string) {
    return this.request<{ success: boolean; data: any }>(`/transfers/proof/${reference}`);
  }

  // Admin & Auditor
  static getUsers(page: number = 1) {
    return this.request<{ success: boolean; data: { users: any[]; total: number } }>(`/admin/users?page=${page}`);
  }

  static updateUser(id: string, payload: { status?: string; role?: string; kycStatus?: string }) {
    return this.request<{ success: boolean; data: any }>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  static verifyLedger() {
    return this.request<{ success: boolean; data: any }>('/admin/ledger/verify');
  }

  static getAuditTrail(limit: number = 50) {
    return this.request<{ success: boolean; data: { logs: any[]; total: number } }>(`/admin/audit-trail?limit=${limit}`);
  }

  static getStats() {
    return this.request<{ success: boolean; data: any }>('/admin/stats');
  }
}
