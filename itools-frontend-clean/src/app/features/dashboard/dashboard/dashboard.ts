import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { forkJoin, interval, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth';

interface OutilDto {
  id: number;
  codeOutillage?: string;
  code?: string;
  ott?: string;
  status?: string;
  statut?: string;
  emplacementId?: number;
}

interface EmplacementDto {
  id: number;
  status?: string;
  statut?: string;
}

interface UserDto {
  id: number;
}

interface ToolReservationStat {
  label: string;
  count: number;
  statusLabel: string;
}

interface EmplacementPart {
  label: string;
  value: number;
  percentage: number;
  colorVar: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly apiUrl = 'http://localhost:5160/api';
  private readonly refreshDelayMs = 30000;

  private refreshSubscription?: Subscription;

  isLoading = false;
  lastUpdatedAt: Date | null = null;
  errorMessage = '';

  stats = {
    freeEmplacements: 0,
    outils: 0,
    hsEmplacements: 0,
    users: 0,
    occupiedEmplacements: 0,
    totalEmplacements: 0
  };

  toolReservationStats: ToolReservationStat[] = [];
  emplacementParts: EmplacementPart[] = [];

  ngOnInit(): void {
    this.loadDashboardData();

    this.refreshSubscription = interval(this.refreshDelayMs).subscribe(() => {
      this.loadDashboardData(false);
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  refreshNow(): void {
    this.loadDashboardData(true);
  }

  get maxReservationValue(): number {
    const max = Math.max(...this.toolReservationStats.map(item => item.count), 0);
    return max <= 0 ? 1 : max;
  }

  get yAxisMaxLabel(): number {
    return this.maxReservationValue;
  }

  get pieChartBackground(): string {
    const total = this.stats.totalEmplacements;

    if (total <= 0) {
      return 'conic-gradient(var(--all-light-grey) 0deg 360deg)';
    }

    const libreDeg = this.degrees(this.stats.freeEmplacements, total);
    const occupeDeg = this.degrees(this.stats.occupiedEmplacements, total);
    const hsDeg = Math.max(0, 360 - libreDeg - occupeDeg);

    return `conic-gradient(
      var(--ux-green) 0deg ${libreDeg}deg,
      var(--all-yellow) ${libreDeg}deg ${libreDeg + occupeDeg}deg,
      var(--all-red) ${libreDeg + occupeDeg}deg ${libreDeg + occupeDeg + hsDeg}deg
    )`;
  }

  getPieTooltip(partLabel: string): string {
    const part = this.emplacementParts.find(item => item.label === partLabel);

    if (!part) {
      return '0%';
    }

    return `${part.percentage.toFixed(2)}%`;
  }

  private loadDashboardData(showLoader = true): void {
    if (showLoader) {
      this.isLoading = true;
    }

    this.errorMessage = '';

    forkJoin({
      outils: this.safeGet<OutilDto[]>('/Outils'),
      emplacements: this.safeGet<EmplacementDto[]>('/Emplacements'),
      users: this.safeGet<UserDto[]>('/Users')
    }).subscribe({
      next: ({ outils, emplacements, users }) => {
        this.buildStats(outils, emplacements, users);
        this.lastUpdatedAt = new Date();
        this.isLoading = false;
      },
      error: error => {
        console.error(error);
        this.errorMessage = 'Erreur lors du chargement du tableau de bord.';
        this.isLoading = false;
      }
    });
  }

  private buildStats(
    outils: OutilDto[],
    emplacements: EmplacementDto[],
    users: UserDto[]
  ): void {
    const freeEmplacements = emplacements.filter(item =>
      this.normalizeStatus(item.status || item.statut) === 'LIBRE'
    ).length;

    const occupiedEmplacements = emplacements.filter(item =>
      this.normalizeStatus(item.status || item.statut) === 'OCCUPE'
    ).length;

    const hsEmplacements = emplacements.filter(item =>
      this.normalizeStatus(item.status || item.statut) === 'HS'
    ).length;

    this.stats = {
      freeEmplacements,
      outils: outils.length,
      hsEmplacements,
      users: users.length,
      occupiedEmplacements,
      totalEmplacements: emplacements.length
    };

    this.toolReservationStats = this.buildToolReservationStats(outils);

    const total = emplacements.length || 0;

    this.emplacementParts = [
      {
        label: 'LIBRE',
        value: freeEmplacements,
        percentage: this.percentage(freeEmplacements, total),
        colorVar: 'var(--ux-green)'
      },
      {
        label: 'OCCUPÉ',
        value: occupiedEmplacements,
        percentage: this.percentage(occupiedEmplacements, total),
        colorVar: 'var(--all-yellow)'
      },
      {
        label: 'HS',
        value: hsEmplacements,
        percentage: this.percentage(hsEmplacements, total),
        colorVar: 'var(--all-red)'
      }
    ];
  }

  private buildToolReservationStats(outils: OutilDto[]): ToolReservationStat[] {
    const visibleTools = outils.slice(0, 6);

    if (visibleTools.length === 0) {
      return [
        {
          label: 'Aucun outil',
          count: 0,
          statusLabel: 'Aucune donnée disponible'
        }
      ];
    }

    return visibleTools.map(outil => {
      const label =
        outil.codeOutillage ||
        outil.code ||
        outil.ott ||
        `Outil ${outil.id}`;

      const hasEmplacement = !!outil.emplacementId;

      return {
        label,
        count: hasEmplacement ? 1 : 0,
        statusLabel: hasEmplacement ? 'Emplacement affecté' : 'Aucun emplacement'
      };
    });
  }

  private safeGet<T>(endpoint: string) {
    return this.http.get<T>(`${this.apiUrl}${endpoint}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(error => {
        console.error(`Erreur dashboard endpoint ${endpoint}`, error);
        return of([] as T);
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

  private normalizeStatus(value?: string | null): string {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace('É', 'E')
      .replace('È', 'E')
      .replace('Ê', 'E')
      .replace('À', 'A');
  }

  private percentage(value: number, total: number): number {
    if (total <= 0) {
      return 0;
    }

    return (value / total) * 100;
  }

  private degrees(value: number, total: number): number {
    if (total <= 0) {
      return 0;
    }

    return Math.round((value / total) * 360);
  }
}
