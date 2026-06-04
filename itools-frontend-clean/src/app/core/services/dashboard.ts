import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, timeout } from 'rxjs';

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

  private readonly apiUrl = 'http://localhost:5160/api/Dashboard/stats';

  getStats(): Observable<DashboardStats> {
    return this.http.get<any>(this.apiUrl).pipe(
      timeout(10000),
      map(response => this.normalizeStats(response)),
      catchError(error => {
        console.error('Erreur chargement dashboard stats :', error);
        return of(this.getEmptyStats());
      })
    );
  }

  private normalizeStats(response: any): DashboardStats {
    if (!response) {
      return this.getEmptyStats();
    }

    const emplacementsLibres = this.toNumber(response.totalEmplacementsLibres ?? response.emplacementsLibres);
    const emplacementsOccupes = this.toNumber(response.totalEmplacementsOccupes ?? response.emplacementsOccupes);
    const emplacementsHs = this.toNumber(response.totalEmplacementsHs ?? response.emplacementsHs);

    return {
      totalOutils: this.toNumber(response.totalOutils),
      totalUsers: this.toNumber(response.totalUsers),
      totalEmplacements: this.toNumber(response.totalEmplacements),

      emplacementsLibres: emplacementsLibres,
      emplacementsOccupes: emplacementsOccupes,
      emplacementsHs: emplacementsHs,

      outilsEnService: this.toNumber(response.outilsEnService),
      outilsHs: this.toNumber(response.outilsHs),
      outilsReserves: this.toNumber(response.outilsReserves),

      pieLabels: this.toStringArray(response.pieLabels, ['LIBRE', 'OCCUPÉ', 'HS']),
      pieData: this.toNumberArray(response.pieData, [
        emplacementsLibres,
        emplacementsOccupes,
        emplacementsHs
      ]),

      barLabels: this.toStringArray(response.barLabels, ['Aucun outil']),
      barData: this.toNumberArray(response.barData, [0])
    };
  }

  private getEmptyStats(): DashboardStats {
    return {
      totalOutils: 0,
      totalUsers: 0,
      totalEmplacements: 0,

      emplacementsLibres: 0,
      emplacementsOccupes: 0,
      emplacementsHs: 0,

      outilsEnService: 0,
      outilsHs: 0,
      outilsReserves: 0,

      pieLabels: ['LIBRE', 'OCCUPÉ', 'HS'],
      pieData: [0, 0, 0],

      barLabels: ['Aucun outil'],
      barData: [0]
    };
  }

  private toNumber(value: any): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toStringArray(value: any, fallback: string[]): string[] {
    if (Array.isArray(value)) {
      return value.map(item => String(item));
    }

    if (Array.isArray(value?.$values)) {
      return value.$values.map((item: any) => String(item));
    }

    return fallback;
  }

  private toNumberArray(value: any, fallback: number[]): number[] {
    if (Array.isArray(value)) {
      return value.map(item => this.toNumber(item));
    }

    if (Array.isArray(value?.$values)) {
      return value.$values.map((item: any) => this.toNumber(item));
    }

    return fallback;
  }
}