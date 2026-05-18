import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DashboardStats {
  totalOutils: number;
  totalUsers: number;
  totalEmplacements: number;

  emplacementsLibres: number;
  emplacementsOccupes: number;
  emplacementsHs: number;

  outilsEnService: number;
  outilsHs: number;
  outilsReserves: number;

  pieLabels: string[];
  pieData: number[];

  barLabels: string[];
  barData: number[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:5160/api/Dashboard';

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.apiUrl}/stats`);
  }
}