import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

const AUTH_STORAGE_KEY = 'cloud9-auth-session';
const API_BASE_URL = environment.apiBaseUrl;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_BASE_URL}/auth/login`, {
        email: email.trim().toLowerCase(),
        password,
      })
      .pipe(tap((session) => sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))));
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }

  isAuthenticated(): boolean {
    return Boolean(this.session?.accessToken);
  }

  get userEmail(): string {
    return this.session?.user.email ?? '';
  }

  get profileInitial(): string {
    return this.userEmail.charAt(0).toUpperCase() || 'C';
  }

  get userRole(): string {
    return this.session?.user.role ?? '';
  }

  get userId(): string {
    return this.session?.user.id ?? '';
  }

  get canManageUsers(): boolean {
    return ['SUPER_ADMIN', 'ADMIN'].includes(this.userRole);
  }

  get canAccessSales(): boolean {
    return ['SUPER_ADMIN', 'ADMIN', 'SALES'].includes(this.userRole);
  }

  get canAccessScheduler(): boolean {
    return ['SUPER_ADMIN', 'ADMIN', 'SALES', 'MANAGER'].includes(this.userRole);
  }

  get accessToken(): string | null {
    return this.session?.accessToken ?? null;
  }

  private get session(): LoginResponse | null {
    const rawSession = sessionStorage.getItem(AUTH_STORAGE_KEY);

    if (!rawSession) {
      return null;
    }

    try {
      return JSON.parse(rawSession) as LoginResponse;
    } catch {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  }
}
