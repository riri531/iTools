import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
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

interface CalendarDay {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  archives: ArchiveItem[];
}

@Component({
  selector: 'app-archives',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, FormsModule, DatePipe],
  templateUrl: './archives.html',
  styleUrl: './archives.scss'
})
export class ArchivesComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  private apiUrl = 'http://localhost:5160/api/Archives';

  archives: ArchiveItem[] = [];
  filteredArchives: ArchiveItem[] = [];
  calendarDays: CalendarDay[] = [];

  currentMonth = new Date();
  selectedDay: CalendarDay | null = null;

  searchText = '';
  selectedAction = '';
  selectedEntity = '';

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  actionOptions: string[] = [];
  entityOptions: string[] = [];

  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  ngOnInit(): void {
    this.loadArchives();
  }

  loadArchives(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<ArchiveItem[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.archives = data || [];
        this.filteredArchives = [...this.archives];

        this.actionOptions = this.getUniqueValues(
          this.archives.map((archive) => archive.action)
        );

        this.entityOptions = this.getUniqueValues(
          this.archives.map((archive) => archive.entityName)
        );

        this.selectedDay = null;
        this.buildCalendar();

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error(err);
        this.errorMessage = 'Erreur lors du chargement des archives.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    const search = this.normalizeText(this.searchText);

    this.filteredArchives = this.archives.filter((item) => {
      const matchesSearch =
        !search ||
        this.normalizeText(item.userName).includes(search) ||
        this.normalizeText(item.role).includes(search) ||
        this.normalizeText(item.action).includes(search) ||
        this.normalizeText(item.entityName).includes(search) ||
        this.normalizeText(item.description).includes(search);

      const matchesAction =
        !this.selectedAction || item.action === this.selectedAction;

      const matchesEntity =
        !this.selectedEntity || item.entityName === this.selectedEntity;

      return matchesSearch && matchesAction && matchesEntity;
    });

    this.selectedDay = null;
    this.buildCalendar();
    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.searchText = '';
    this.selectedAction = '';
    this.selectedEntity = '';
    this.filteredArchives = [...this.archives];
    this.selectedDay = null;
    this.buildCalendar();
    this.cdr.detectChanges();
  }

  previousMonth(): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() - 1,
      1
    );

    this.selectedDay = null;
    this.buildCalendar();
    this.cdr.detectChanges();
  }

  nextMonth(): void {
    this.currentMonth = new Date(
      this.currentMonth.getFullYear(),
      this.currentMonth.getMonth() + 1,
      1
    );

    this.selectedDay = null;
    this.buildCalendar();
    this.cdr.detectChanges();
  }

  goToToday(): void {
    this.currentMonth = new Date();
    this.selectedDay = null;
    this.buildCalendar();
    this.cdr.detectChanges();
  }

  selectDay(day: CalendarDay): void {
    if (day.archives.length === 0) {
      this.selectedDay = null;
      return;
    }

    if (this.selectedDay?.dateKey === day.dateKey) {
      this.selectedDay = null;
    } else {
      this.selectedDay = day;
    }

    this.cdr.detectChanges();
  }

  openDayDetails(day: CalendarDay): void {
    this.router.navigate(['/app/archives', day.dateKey]);
  }

  downloadArchives(): void {
    const rows = this.filteredArchives.map((item) => ({
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
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Archives');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'archives_operations.xlsx');

    this.showSuccess('Archives téléchargées avec succès.');
  }

  getMonthTitle(): string {
    return this.currentMonth.toLocaleDateString('fr-FR', {
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

  getPreviewItems(day: CalendarDay): ArchiveItem[] {
    return day.archives.slice(0, 3);
  }

  private buildCalendar(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startDay = this.getMondayBasedDay(firstDayOfMonth);
    const calendarStart = new Date(year, month, 1 - startDay);

    const days: CalendarDay[] = [];

    for (let i = 0; i < 42; i++) {
      const date = new Date(
        calendarStart.getFullYear(),
        calendarStart.getMonth(),
        calendarStart.getDate() + i
      );

      const dateKey = this.toDateKey(date);

      const archivesOfDay = this.filteredArchives.filter((archive) => {
        const archiveDate = new Date(archive.createdAt);
        return this.toDateKey(archiveDate) === dateKey;
      });

      days.push({
        date,
        dateKey,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: dateKey === this.toDateKey(new Date()),
        archives: archivesOfDay
      });
    }

    this.calendarDays = days;
  }

  private getMondayBasedDay(date: Date): number {
    const day = date.getDay();

    return day === 0 ? 6 : day - 1;
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private getUniqueValues(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => !!value))).sort();
  }

  private normalizeText(value: string | null | undefined): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
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