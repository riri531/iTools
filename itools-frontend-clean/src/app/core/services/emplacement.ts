import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EmplacementItem {
  id: number;
  matiereId: number;
  matiereName: string;
  armoire: string;
  numero: string;
  designationId: number;
  designationName: string;
  status: string;
}

export interface CreateEmplacementRequest {
  matiereId: number;
  armoire: string;
  numero: string;
  designationId: number;
  status: string;
}

export interface UpdateEmplacementRequest {
  matiereId: number;
  armoire: string;
  numero: string;
  designationId: number;
  status: string;
}

export interface SimpleMatiereItem {
  id: number;
  nomMatiere: string;
}

export interface SimpleDesignationItem {
  id: number;
  name: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmplacementService {
  private http = inject(HttpClient);

  private emplacementsApi = 'http://localhost:5160/api/Emplacements';
  private matieresApi = 'http://localhost:5160/api/Matieres';
  private designationsApi = 'http://localhost:5160/api/Designations';

  getEmplacements(): Observable<EmplacementItem[]> {
    return this.http.get<EmplacementItem[]>(this.emplacementsApi);
  }

  createEmplacement(data: CreateEmplacementRequest): Observable<EmplacementItem> {
    return this.http.post<EmplacementItem>(this.emplacementsApi, data);
  }

  updateEmplacement(id: number, data: UpdateEmplacementRequest): Observable<void> {
    return this.http.put<void>(`${this.emplacementsApi}/${id}`, data);
  }

  deleteEmplacement(id: number): Observable<void> {
    return this.http.delete<void>(`${this.emplacementsApi}/${id}`);
  }

  getMatieres(): Observable<SimpleMatiereItem[]> {
    return this.http.get<SimpleMatiereItem[]>(this.matieresApi);
  }

  getDesignations(): Observable<SimpleDesignationItem[]> {
    return this.http.get<SimpleDesignationItem[]>(this.designationsApi);
  }
}