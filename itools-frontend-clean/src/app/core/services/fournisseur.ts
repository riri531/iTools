import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FournisseurItem {
  id: number;
  codeFournisseur: string;
  nomFournisseur: string;
}

export interface CreateFournisseurRequest {
  codeFournisseur: string;
  nomFournisseur: string;
}

export interface UpdateFournisseurRequest {
  codeFournisseur: string;
  nomFournisseur: string;
}

@Injectable({
  providedIn: 'root'
})
export class FournisseurService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5160/api/Fournisseurs';

  getFournisseurs(): Observable<FournisseurItem[]> {
    return this.http.get<FournisseurItem[]>(this.apiUrl);
  }

  createFournisseur(data: CreateFournisseurRequest): Observable<FournisseurItem> {
    return this.http.post<FournisseurItem>(this.apiUrl, data);
  }

  updateFournisseur(id: number, data: UpdateFournisseurRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, data);
  }

  deleteFournisseur(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}