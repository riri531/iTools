import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ClientItem {
  id: number;
  nomClient: string;
  nomFamille: string;
  nomReference: string;
}

export interface CreateClientRequest {
  nomClient: string;
  nomFamille: string;
  nomReference: string;
}

export interface UpdateClientRequest {
  nomClient: string;
  nomFamille: string;
  nomReference: string;
}

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5160/api/Clients';

  getClients(): Observable<ClientItem[]> {
    return this.http.get<ClientItem[]>(this.apiUrl);
  }

  createClient(data: CreateClientRequest): Observable<ClientItem> {
    return this.http.post<ClientItem>(this.apiUrl, data);
  }

  updateClient(id: number, data: UpdateClientRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, data);
  }

  deleteClient(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}