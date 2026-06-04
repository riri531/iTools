import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';
import { Subscription, interval, startWith, switchMap } from 'rxjs';
import { DashboardService, DashboardStats } from '../../../core/services/dashboard';

interface BarItem {
  label: string;
  value: number;
  height: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private dashboardService = inject(DashboardService);
  private cdr = inject(ChangeDetectorRef);

  private refreshSubscription?: Subscription;

  readonly refreshDelayMs = 5 * 60 * 60 * 1000;

  isLoading = false;
  lastRefresh: Date | null = null;
  errorMessage = '';

  stats: DashboardStats = this.getEmptyStats();

  ngOnInit(): void {
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  refreshNow(): void {
    this.loadStats();
  }

  get totalEmplacementPie(): number {
    return this.stats.emplacementsLibres +
      this.stats.emplacementsOccupes +
      this.stats.emplacementsHs;
  }

  get pieChartStyle(): Record<string, string> {
    const total = this.totalEmplacementPie;

    if (total <= 0) {
      return {
        background: 'conic-gradient(#eef0f1 0deg 360deg)'
      };
    }

    const libreDeg = (this.stats.emplacementsLibres / total) * 360;
    const occupeDeg = (this.stats.emplacementsOccupes / total) * 360;
    const hsDeg = 360 - libreDeg - occupeDeg;

    const libreEnd = libreDeg;
    const occupeEnd = libreDeg + occupeDeg;
    const hsEnd = libreDeg + occupeDeg + hsDeg;

    return {
      background: `conic-gradient(#2f8f5b 0deg ${libreEnd}deg, #ffc000 ${libreEnd}deg ${occupeEnd}deg, #e00034 ${occupeEnd}deg ${hsEnd}deg)`
    };
  }

  get barItems(): BarItem[] {
    const labels = this.stats.barLabels.length ? this.stats.barLabels : ['Aucun outil'];
    const data = this.stats.barData.length ? this.stats.barData : [0];
    const max = Math.max(...data, 1);

    return labels.slice(0, 10).map((label, index) => {
      const value = Number(data[index] || 0);

      return {
        label,
        value,
        height: Math.max((value / max) * 100, value > 0 ? 8 : 0)
      };
    });
  }

  get yAxisMax(): number {
    return Math.max(...this.stats.barData, 1);
  }

  get refreshButtonLabel(): string {
    return this.isLoading ? 'Actualisation...' : 'Actualiser';
  }

  private startAutoRefresh(): void {
    this.refreshSubscription?.unsubscribe();

    this.refreshSubscription = interval(this.refreshDelayMs).pipe(
      startWith(0),
      switchMap(() => {
        this.isLoading = true;
        this.errorMessage = '';
        this.cdr.detectChanges();

        return this.dashboardService.getStats();
      })
    ).subscribe({
      next: stats => {
        console.log('Dashboard stats reçues :', stats);

        this.stats = stats || this.getEmptyStats();
        this.lastRefresh = new Date();
        this.isLoading = false;
        this.errorMessage = '';

        this.cdr.detectChanges();
      },

      error: error => {
        console.error('Erreur dashboard :', error);

        this.stats = this.getEmptyStats();
        this.errorMessage = 'Impossible de charger les données du dashboard.';
        this.isLoading = false;

        this.cdr.detectChanges();
      }
    });
  }

  private loadStats(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.dashboardService.getStats().subscribe({
      next: stats => {
        console.log('Dashboard stats reçues manuellement :', stats);

        this.stats = stats || this.getEmptyStats();
        this.lastRefresh = new Date();
        this.isLoading = false;
        this.errorMessage = '';

        this.cdr.detectChanges();
      },

      error: error => {
        console.error('Erreur dashboard :', error);

        this.stats = this.getEmptyStats();
        this.errorMessage = 'Impossible de charger les données du dashboard.';
        this.isLoading = false;

        this.cdr.detectChanges();
      }
    });
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
}