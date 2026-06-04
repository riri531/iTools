import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface LoginRequest {
  email: string;
  password: string;
  recaptchaToken?: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  token: string;
  email: string;
  role: string;
  fullName: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  resetLink?: string;
}

export interface ResetPasswordRequest {
  userId: number;
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface MessageResponse {
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5160/api/Auth';

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, data).pipe(
      tap((response) => {
        const rememberMe = !!data.rememberMe;
        const storage = rememberMe ? localStorage : sessionStorage;

        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('email');
        localStorage.removeItem('fullName');

        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('email');
        sessionStorage.removeItem('fullName');

        storage.setItem('token', response.token);
        storage.setItem('role', this.normalizeRole(response.role));
        storage.setItem('email', response.email);
        storage.setItem('fullName', response.fullName);

        if (rememberMe) {
          localStorage.setItem('rememberedEmail', response.email);
          localStorage.setItem('rememberMeEnabled', 'true');
        } else {
          localStorage.removeItem('rememberedEmail');
          localStorage.removeItem('rememberMeEnabled');
        }
      })
    );
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(
      `${this.apiUrl}/forgot-password`,
      data
    );
  }

  resetPassword(data: ResetPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(
      `${this.apiUrl}/reset-password`,
      data
    );
  }

  logout(): void {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    const rememberMeEnabled = localStorage.getItem('rememberMeEnabled');

    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
    localStorage.removeItem('fullName');

    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('email');
    sessionStorage.removeItem('fullName');

    if (rememberMeEnabled === 'true' && rememberedEmail) {
      localStorage.setItem('rememberedEmail', rememberedEmail);
      localStorage.setItem('rememberMeEnabled', 'true');
    } else {
      localStorage.removeItem('rememberedEmail');
      localStorage.removeItem('rememberMeEnabled');
    }
  }

  getToken(): string | null {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  getRole(): string | null {
    const role =
      localStorage.getItem('role') ||
      sessionStorage.getItem('role') ||
      '';

    return this.normalizeRole(role);
  }

  getFullName(): string | null {
    return localStorage.getItem('fullName') || sessionStorage.getItem('fullName');
  }

  getEmail(): string | null {
    return localStorage.getItem('email') || sessionStorage.getItem('email');
  }

  getRememberedEmail(): string {
    return localStorage.getItem('rememberedEmail') || '';
  }

  isRememberMeEnabled(): boolean {
    return localStorage.getItem('rememberMeEnabled') === 'true';
  }

  updateCurrentUser(fullName: string, email: string): void {
    const storage = localStorage.getItem('token') ? localStorage : sessionStorage;

    storage.setItem('fullName', fullName);
    storage.setItem('email', email);

    if (this.isRememberMeEnabled()) {
      localStorage.setItem('rememberedEmail', email);
    }
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    return this.getRole() === 'ADMIN';
  }

  isResponsable(): boolean {
    return this.getRole() === 'RESPONSABLE';
  }

  isEmploye(): boolean {
    return this.getRole() === 'EMPLOYE';
  }

  hasAnyRole(roles: string[]): boolean {
    const currentRole = this.getRole();

    if (!currentRole) {
      return false;
    }

    const normalizedRoles = roles.map(role => this.normalizeRole(role));

    return normalizedRoles.includes(currentRole);
  }

  canManageData(): boolean {
    const role = this.getRole();
    return role === 'ADMIN' || role === 'RESPONSABLE';
  }

  canCreateReclamation(): boolean {
    const role = this.getRole();

    return role === 'EMPLOYE' || role === 'RESPONSABLE';
  }

  canTreatReclamation(): boolean {
    const role = this.getRole();

    return role === 'ADMIN' || role === 'RESPONSABLE';
  }

  private normalizeRole(role: string | null | undefined): string {
    return String(role || '')
      .trim()
      .toUpperCase()
      .replace('É', 'E');
  }
}