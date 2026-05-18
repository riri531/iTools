import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface ArchiveItem {
  id: number;
  userId: number | null;
  userName: string;
  role: string;
  action: string;
  entityName: string;
  entityId: number | null;
  description: string;
  oldValues: string | null;
  newValues: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-archive-day',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, DatePipe],
  templateUrl: './archive-day.html',
  styleUrl: './archive-day.scss'
})
export class ArchiveDayComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  private apiUrl = 'http://localhost:5160/api/Archives';

  dateKey = '';
  archives: ArchiveItem[] = [];

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.dateKey = this.route.snapshot.paramMap.get('date') || '';
    this.loadArchives();
  }

  loadArchives(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<ArchiveItem[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.archives = (data || []).filter(item =>
          this.toDateKey(new Date(item.createdAt)) === this.dateKey
        );

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error(err);
        this.errorMessage = 'Erreur lors du chargement des archives de cette date.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  backToCalendar(): void {
    this.router.navigate(['/app/archives']);
  }

  downloadDayArchives(): void {
    const rows = this.archives.map(item => ({
      id: item.id,
      date: this.formatDate(item.createdAt),
      utilisateur: item.userName,
      role: item.role,
      action: this.getActionLabel(item.action),
      actionCode: item.action,
      entite: item.entityName,
      entityId: item.entityId ?? '',
      description: item.description,
      anciennesValeurs: this.prettyJson(item.oldValues),
      nouvellesValeurs: this.prettyJson(item.newValues)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 24 },
      { wch: 16 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 55 },
      { wch: 70 },
      { wch: 70 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ArchivesDate');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, `archives_${this.dateKey}.xlsx`);

    this.showSuccess('Archives de cette date téléchargées avec succès.');
  }

  getFormattedSelectedDate(): string {
    if (!this.dateKey) {
      return '';
    }

    const date = new Date(`${this.dateKey}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return this.dateKey;
    }

    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  getActionLabel(action: string): string {
    switch (action) {
      case 'CREATE':
        return 'Ajout';
      case 'UPDATE':
        return 'Modification';
      case 'DELETE':
        return 'Suppression';
      case 'LOGIN_SUCCESS':
        return 'Connexion réussie';
      case 'LOGIN_FAILED':
        return 'Connexion échouée';
      case 'LOGOUT':
        return 'Déconnexion';
      default:
        return action;
    }
  }

  getActionClass(action: string): string {
    switch (action) {
      case 'CREATE':
      case 'LOGIN_SUCCESS':
        return 'success';
      case 'UPDATE':
        return 'warning';
      case 'DELETE':
      case 'LOGIN_FAILED':
        return 'danger';
      case 'LOGOUT':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  prettyJson(value: string | null): string {
    if (!value) {
      return '-';
    }

    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private formatDate(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('fr-FR');
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.successMessage = '';
      this.cdr.detectChanges();
    }, 3000);
  }
}