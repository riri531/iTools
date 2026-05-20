import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserItem {
  id: number;
  fullName: string;
  email: string;
  roleId: number;
  roleName: string;
  profilePhotoUrl?: string | null;
  imageUrl?: string | null;
  photoUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface RoleItem {
  id: number;
  name: string;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  password: string;
  roleId: number;
}

export interface UpdateUserRequest {
  fullName: string;
  email: string;
  roleId: number;
  password?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5160/api';

  getUsers(): Observable<UserItem[]> {
    return this.http.get<UserItem[]>(`${this.apiUrl}/Users`);
  }

  getRoles(): Observable<RoleItem[]> {
    return this.http.get<RoleItem[]>(`${this.apiUrl}/Roles`);
  }

  createUser(payload: CreateUserRequest | FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/Users`, payload);
  }

  updateUser(id: number, payload: UpdateUserRequest | FormData): Observable<any> {
    return this.http.put(`${this.apiUrl}/Users/${id}`, payload);
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/Users/${id}`);
  }

  importUsers(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/Users/import`, formData);
  }

  downloadUserCard(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/Users/${id}/identity-card`, {
      responseType: 'blob'
    });
  }
}