import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of, timeout } from 'rxjs';
import { AuthService } from './auth';

export interface GlobalSearchResult {
  type: string;
  label: string;
  description: string;
  route: string;
  icon: string;
  score?: number;
}

@Injectable({
  providedIn: 'root'
})
export class GlobalSearchService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly apiUrl = 'http://localhost:5160/api/GlobalSearch';

  search(keyword: string): Observable<GlobalSearchResult[]> {
    const q = (keyword || '').trim();

    if (!q) {
      return of([]);
    }

    return this.http
      .get<GlobalSearchResult[]>(this.apiUrl, {
        params: {
          keyword: q
        },
        headers: this.getAuthHeaders()
      })
      .pipe(
        timeout(6000),
        map(results => Array.isArray(results) ? results : []),
        catchError(error => {
          console.error('Erreur recherche globale :', error);
          return of([]);
        })
      );
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();

    if (!token) {
      return new HttpHeaders();
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }
}
