import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

const API_BASE_URL = environment.apiBaseUrl;

export type UserRole =
  | 'SUPER_ADMIN'
  | 'MANAGER'
  | 'ADMIN'
  | 'SALES'
  | 'PRODUCTION'
  | 'DISPATCH'
  | 'CUSTOMER';

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  email: string;
  name?: string;
  password: string;
  role?: UserRole;
}

export interface UpdateUserPayload {
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  password?: string;
}

@Injectable({
  providedIn: 'root',
})
export class UserService {
  constructor(private readonly http: HttpClient) {}

  getUsers(): Observable<ManagedUser[]> {
    return this.http.get<ManagedUser[]>(`${API_BASE_URL}/users`);
  }

  createUser(user: CreateUserPayload): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(`${API_BASE_URL}/users`, {
      ...user,
      email: user.email.trim().toLowerCase(),
    });
  }

  updateUser(userId: string, user: UpdateUserPayload): Observable<ManagedUser> {
    return this.http.put<ManagedUser>(`${API_BASE_URL}/users/${userId}`, {
      ...user,
      email: user.email.trim().toLowerCase(),
    });
  }

  deleteUser(userId: string): Observable<{ id: string; deleted: boolean }> {
    return this.http.delete<{ id: string; deleted: boolean }>(`${API_BASE_URL}/users/${userId}`);
  }
}
