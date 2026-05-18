import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DesignationItem {
  id: number;
  name: string;
}

export interface CreateDesignationRequest {
  name: string;
}

export interface UpdateDesignationRequest {
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class DesignationService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5160/api/Designations';

  getDesignations(): Observable<DesignationItem[]> {
    return this.http.get<DesignationItem[]>(this.apiUrl);
  }

  createDesignation(data: CreateDesignationRequest): Observable<DesignationItem> {
    return this.http.post<DesignationItem>(this.apiUrl, data);
  }

  updateDesignation(id: number, data: UpdateDesignationRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, data);
  }

  deleteDesignation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}