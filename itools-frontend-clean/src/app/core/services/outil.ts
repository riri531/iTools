import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OutilItem {
  id: number;
  ligneId: number;
  ligneName: string;
  clientId: number;
  clientName: string;
  fournisseurId: number;
  fournisseurName: string;
  emplacementId: number;
  emplacementLabel: string;
  ott: string;
  codeOutillage: string;
  status: string;
  valeur: number;
  justificationHS?: string;
  dateAffectation?: string;
}

export interface CreateOutilRequest {
  ligneId: number;
  clientId: number;
  fournisseurId: number;
  emplacementId: number;
  ott: string;
  codeOutillage: string;
  status: string;
  valeur: number;
  justificationHS?: string | null;
  dateAffectation?: string | null;
}

export interface UpdateOutilRequest {
  ligneId: number;
  clientId: number;
  fournisseurId: number;
  emplacementId: number;
  ott: string;
  codeOutillage: string;
  status: string;
  valeur: number;
  justificationHS?: string | null;
  dateAffectation?: string | null;
}

export interface SimpleLigneItem {
  id: number;
  nom: string;
}

export interface SimpleClientItem {
  id: number;
  nomClient: string;
}

export interface SimpleFournisseurItem {
  id: number;
  nomFournisseur: string;
}

export interface SimpleEmplacementItem {
  id: number;
  armoire: string;
  numero: string;
}

@Injectable({
  providedIn: 'root'
})
export class OutilService {
  private http = inject(HttpClient);

  private outilsApi = 'http://localhost:5160/api/Outils';
  private lignesApi = 'http://localhost:5160/api/Lignes';
  private clientsApi = 'http://localhost:5160/api/Clients';
  private fournisseursApi = 'http://localhost:5160/api/Fournisseurs';
  private emplacementsApi = 'http://localhost:5160/api/Emplacements';

  getOutils(): Observable<OutilItem[]> {
    return this.http.get<OutilItem[]>(this.outilsApi);
  }

  createOutil(data: CreateOutilRequest): Observable<OutilItem> {
    return this.http.post<OutilItem>(this.outilsApi, data);
  }

  updateOutil(id: number, data: UpdateOutilRequest): Observable<void> {
    return this.http.put<void>(`${this.outilsApi}/${id}`, data);
  }

  deleteOutil(id: number): Observable<void> {
    return this.http.delete<void>(`${this.outilsApi}/${id}`);
  }

  getLignes(): Observable<SimpleLigneItem[]> {
    return this.http.get<SimpleLigneItem[]>(this.lignesApi);
  }

  getClients(): Observable<SimpleClientItem[]> {
    return this.http.get<SimpleClientItem[]>(this.clientsApi);
  }

  getFournisseurs(): Observable<SimpleFournisseurItem[]> {
    return this.http.get<SimpleFournisseurItem[]>(this.fournisseursApi);
  }

  getEmplacements(): Observable<SimpleEmplacementItem[]> {
    return this.http.get<SimpleEmplacementItem[]>(this.emplacementsApi);
  }
}