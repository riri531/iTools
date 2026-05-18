import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LigneItem {
  id: number;
  nom: string;
}

export interface CreateLigneRequest {
  nom: string;
}

export interface UpdateLigneRequest {
  nom: string;
}

@Injectable({
  providedIn: 'root'
})
export class LigneService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5160/api/Lignes';

  getLignes(): Observable<LigneItem[]> {
    return this.http.get<LigneItem[]>(this.apiUrl);
  }

  createLigne(data: CreateLigneRequest): Observable<LigneItem> {
    return this.http.post<LigneItem>(this.apiUrl, data);
  }

  updateLigne(id: number, data: UpdateLigneRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, data);
  }

  deleteLigne(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
} 