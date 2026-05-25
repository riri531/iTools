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
        const storage = data.rememberMe ? localStorage : sessionStorage;

        storage.setItem('token', response.token);
        storage.setItem('role', response.role);
        storage.setItem('email', response.email);
        storage.setItem('fullName', response.fullName);

        if (data.rememberMe) {
          localStorage.setItem('rememberedEmail', response.email);
        } else {
          localStorage.removeItem('rememberedEmail');
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
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
    localStorage.removeItem('fullName');
    localStorage.removeItem('rememberedEmail');

    sessionStorage.removeItem('token');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('email');
    sessionStorage.removeItem('fullName');
  }

  getToken(): string | null {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  getRole(): string | null {
    return localStorage.getItem('role') || sessionStorage.getItem('role');
  }

  getFullName(): string | null {
    return localStorage.getItem('fullName') || sessionStorage.getItem('fullName');
  }

  getEmail(): string | null {
    return localStorage.getItem('email') || sessionStorage.getItem('email');
  }

  updateCurrentUser(fullName: string, email: string): void {
    const storage = localStorage.getItem('token') ? localStorage : sessionStorage;

    storage.setItem('fullName', fullName);
    storage.setItem('email', email);
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
    return !!currentRole && roles.includes(currentRole);
  }
}