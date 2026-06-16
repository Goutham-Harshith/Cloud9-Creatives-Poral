import { Injectable } from '@angular/core';

const AUTH_STORAGE_KEY = 'cloud9-auth-email';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly email = 'gouthamharshith115@gmail.com';
  private readonly password = 'test@123';

  login(email: string, password: string): boolean {
    const isValid = email.trim().toLowerCase() === this.email && password === this.password;

    if (isValid) {
      sessionStorage.setItem(AUTH_STORAGE_KEY, this.email);
    }

    return isValid;
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }

  isAuthenticated(): boolean {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) === this.email;
  }

  get userEmail(): string {
    return sessionStorage.getItem(AUTH_STORAGE_KEY) ?? this.email;
  }

  get profileInitial(): string {
    return this.userEmail.charAt(0).toUpperCase();
  }
}
