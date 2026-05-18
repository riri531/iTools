import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface MatiereItem {
  id: number;
  nomMatiere: string;
  process: string;
}

export interface CreateMatiereRequest {
  nomMatiere: string;
  process: string;
}

export interface UpdateMatiereRequest {
  nomMatiere: string;
  process: string;
}

@Injectable({
  providedIn: 'root'
})
export class MatiereService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5160/api/Matieres';

  getMatieres(): Observable<MatiereItem[]> {
    return this.http.get<MatiereItem[]>(this.apiUrl);
  }

  createMatiere(data: CreateMatiereRequest): Observable<MatiereItem> {
    return this.http.post<MatiereItem>(this.apiUrl, data);
  }

  updateMatiere(id: number, data: UpdateMatiereRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, data);
  }

  deleteMatiere(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}