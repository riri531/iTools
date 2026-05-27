import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth';

interface UserNotificationDto {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface AccessRequestDto {
  id: number;
  fullName: string;
  matricule: string;
  email: string;
  phoneNumber: string;
  department: string;
  message?: string;
  status: string;
  decisionComment?: string;
  createdAt: string;
  treatedAt?: string;
  treatedByUserId?: number;
  treatedByUserName?: string;
}

interface RoleDto {
  id: number;
  name: string;
}

type ReadFilter = 'ALL' | 'READ' | 'UNREAD';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIf, NgFor, NgClass, DatePipe],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss'
})
export class NotificationsComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  private apiUrl = 'http://localhost:5160/api/Profile/notifications';
  private accessRequestsApiUrl = 'http://localhost:5160/api/AccessRequests';
  private rolesApiUrl = 'http://localhost:5160/api/Roles';

  notifications: UserNotificationDto[] = [];
  filteredNotifications: UserNotificationDto[] = [];

  accessRequests: AccessRequestDto[] = [];
  roles: RoleDto[] = [];

  selectedAccessRequestId = 0;
  selectedRoleId = 0;
  decisionComment = '';
  processingAccessRequestId = 0;

  selectedReadFilter: ReadFilter = 'ALL';
  selectedType = '';
  searchText = '';

  selectedIds: number[] = [];

  isLoading = false;
  successMessage = '';
  errorMessage = '';

  typeOptions = [
    'PROFILE',
    'SECURITY',
    'RECLAMATION',
    'SYSTEM',
    'ARCHIVE',
    'ACCESS_REQUEST',
    'OTHER'
  ];

  ngOnInit(): void {
    this.loadNotifications();

    if (this.isAdmin()) {
      this.loadAccessRequests();
      this.loadRoles();
    }
  }

  get unreadCount(): number {
    return this.notifications.filter(item => !item.isRead).length;
  }

  get readCount(): number {
    return this.notifications.filter(item => item.isRead).length;
  }

  isAdmin(): boolean {
    return String(this.authService.getRole() || '').toUpperCase() === 'ADMIN';
  }

  get pendingAccessRequestsCount(): number {
    return this.accessRequests.filter(item => item.status === 'EN_ATTENTE').length;
  }

  loadNotifications(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<UserNotificationDto[]>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.notifications = (data || []).map(item => ({
          ...item,
          type: item.type || 'OTHER',
          isRead: item.isRead === true
        }));

        this.selectedIds = [];
        this.applyFilters();

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors du chargement des notifications.'
        );
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadAccessRequests(): void {
    if (!this.isAdmin()) {
      return;
    }

    this.http.get<AccessRequestDto[]>(this.accessRequestsApiUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.accessRequests = data || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors du chargement des demandes d’accès.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  loadRoles(): void {
    if (!this.isAdmin()) {
      return;
    }

    this.http.get<RoleDto[]>(this.rolesApiUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.roles = data || [];

        const employeRole = this.roles.find(role =>
          String(role.name).toUpperCase() === 'EMPLOYE'
        );

        if (employeRole) {
          this.selectedRoleId = employeRole.id;
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors du chargement des rôles.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  selectAccessRequest(request: AccessRequestDto): void {
    this.selectedAccessRequestId = request.id;
    this.decisionComment = '';

    const employeRole = this.roles.find(role =>
      String(role.name).toUpperCase() === 'EMPLOYE'
    );

    this.selectedRoleId = employeRole ? employeRole.id : 0;
  }

  cancelAccessRequestSelection(): void {
    this.selectedAccessRequestId = 0;
    this.selectedRoleId = 0;
    this.decisionComment = '';
  }

  approveAccessRequest(request: AccessRequestDto): void {
    if (!this.selectedRoleId) {
      this.errorMessage = 'Veuillez choisir un rôle avant d’accepter la demande.';
      this.cdr.detectChanges();
      return;
    }

    const confirmed = confirm(
      `Accepter la demande de ${request.fullName} et créer son compte ?`
    );

    if (!confirmed) {
      return;
    }

    this.processingAccessRequestId = request.id;
    this.errorMessage = '';

    const payload = {
      roleId: this.selectedRoleId,
      decisionComment: this.decisionComment
    };

    this.http.put<{ message: string }>(
      `${this.accessRequestsApiUrl}/${request.id}/approve`,
      payload,
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        this.processingAccessRequestId = 0;
        this.showSuccess(response.message || 'Demande acceptée avec succès.');
        this.cancelAccessRequestSelection();
        this.loadAccessRequests();
        this.loadNotifications();
      },
      error: (err) => {
        console.error(err);
        this.processingAccessRequestId = 0;
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors de l’acceptation de la demande.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  rejectAccessRequest(request: AccessRequestDto): void {
    const confirmed = confirm(
      `Refuser la demande de ${request.fullName} ?`
    );

    if (!confirmed) {
      return;
    }

    this.processingAccessRequestId = request.id;
    this.errorMessage = '';

    const payload = {
      roleId: 0,
      decisionComment: this.decisionComment || 'Demande refusée.'
    };

    this.http.put<{ message: string }>(
      `${this.accessRequestsApiUrl}/${request.id}/reject`,
      payload,
      { headers: this.getAuthHeaders() }
    ).subscribe({
      next: (response) => {
        this.processingAccessRequestId = 0;
        this.showSuccess(response.message || 'Demande refusée avec succès.');
        this.cancelAccessRequestSelection();
        this.loadAccessRequests();
        this.loadNotifications();
      },
      error: (err) => {
        console.error(err);
        this.processingAccessRequestId = 0;
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors du refus de la demande.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  getAccessStatusLabel(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'EN_ATTENTE':
        return 'En attente';
      case 'ACCEPTEE':
        return 'Acceptée';
      case 'REFUSEE':
        return 'Refusée';
      default:
        return status || 'Inconnu';
    }
  }

  getAccessStatusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'EN_ATTENTE':
        return 'pending';
      case 'ACCEPTEE':
        return 'accepted';
      case 'REFUSEE':
        return 'rejected';
      default:
        return 'other';
    }
  }

  setReadFilter(filter: ReadFilter): void {
    this.selectedReadFilter = filter;
    this.selectedIds = [];
    this.applyFilters();
  }

  applyFilters(): void {
    const search = this.normalizeText(this.searchText);

    this.filteredNotifications = this.notifications.filter(item => {
      const matchesSearch =
        !search ||
        this.normalizeText(item.title).includes(search) ||
        this.normalizeText(item.message).includes(search) ||
        this.normalizeText(item.type).includes(search) ||
        this.normalizeText(this.getTypeLabel(item.type)).includes(search);

      const matchesRead =
        this.selectedReadFilter === 'ALL' ||
        (this.selectedReadFilter === 'READ' && item.isRead) ||
        (this.selectedReadFilter === 'UNREAD' && !item.isRead);

      const matchesType =
        !this.selectedType || item.type === this.selectedType;

      return matchesSearch && matchesRead && matchesType;
    });

    this.selectedIds = this.selectedIds.filter(id =>
      this.filteredNotifications.some(item => item.id === id)
    );

    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.searchText = '';
    this.selectedType = '';
    this.selectedReadFilter = 'ALL';
    this.selectedIds = [];
    this.applyFilters();
  }

  markAsRead(item: UserNotificationDto): void {
    if (item.isRead) {
      return;
    }

    this.http.put(`${this.apiUrl}/${item.id}/read`, {}, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        item.isRead = true;

        const original = this.notifications.find(n => n.id === item.id);
        if (original) {
          original.isRead = true;
        }

        this.showSuccess('Notification marquée comme lue.');
        this.applyFilters();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors du marquage comme lu.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  markSelectedAsRead(): void {
    if (this.selectedIds.length === 0) {
      return;
    }

    const idsToMark = [...this.selectedIds];

    const requests = idsToMark.map(id =>
      this.http.put(`${this.apiUrl}/${id}/read`, {}, {
        headers: this.getAuthHeaders()
      })
    );

    let completed = 0;
    let hasError = false;

    requests.forEach(request => {
      request.subscribe({
        next: () => {
          completed++;

          if (completed === requests.length) {
            this.notifications = this.notifications.map(item =>
              idsToMark.includes(item.id)
                ? { ...item, isRead: true }
                : item
            );

            this.selectedIds = [];
            this.showSuccess('Notifications sélectionnées marquées comme lues.');
            this.applyFilters();
          }
        },
        error: (err) => {
          console.error(err);
          hasError = true;
          completed++;

          if (completed === requests.length) {
            if (hasError) {
              this.errorMessage = 'Certaines notifications n’ont pas pu être marquées comme lues.';
            }

            this.notifications = this.notifications.map(item =>
              idsToMark.includes(item.id)
                ? { ...item, isRead: true }
                : item
            );

            this.selectedIds = [];
            this.applyFilters();
            this.cdr.detectChanges();
          }
        }
      });
    });
  }

  deleteNotification(item: UserNotificationDto): void {
    const confirmed = confirm(`Supprimer la notification "${item.title}" ?`);

    if (!confirmed) {
      return;
    }

    this.http.delete(`${this.apiUrl}/${item.id}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(n => n.id !== item.id);
        this.selectedIds = this.selectedIds.filter(id => id !== item.id);

        this.showSuccess('Notification supprimée.');
        this.applyFilters();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors de la suppression de la notification.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  deleteSelectedNotifications(): void {
    if (this.selectedIds.length === 0) {
      return;
    }

    const confirmed = confirm(
      `Supprimer ${this.selectedIds.length} notification(s) sélectionnée(s) ?`
    );

    if (!confirmed) {
      return;
    }

    const payload = {
      notificationIds: this.selectedIds
    };

    this.http.post<{ deleted: number }>(`${this.apiUrl}/delete-selected`, payload, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (result) => {
        const deletedIds = [...this.selectedIds];

        this.notifications = this.notifications.filter(
          item => !deletedIds.includes(item.id)
        );

        this.selectedIds = [];

        this.showSuccess(
          `${result?.deleted ?? deletedIds.length} notification(s) supprimée(s).`
        );

        this.applyFilters();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors de la suppression de la sélection.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  deleteAllNotifications(): void {
    if (this.notifications.length === 0) {
      return;
    }

    const confirmed = confirm('Supprimer toutes les notifications ?');

    if (!confirmed) {
      return;
    }

    this.http.delete<{ deleted: number }>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (result) => {
        const deleted = result?.deleted ?? this.notifications.length;

        this.notifications = [];
        this.filteredNotifications = [];
        this.selectedIds = [];

        this.showSuccess(`${deleted} notification(s) supprimée(s).`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors de la suppression de toutes les notifications.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  toggleSelection(item: UserNotificationDto, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    if (checked) {
      if (!this.selectedIds.includes(item.id)) {
        this.selectedIds = [...this.selectedIds, item.id];
      }
    } else {
      this.selectedIds = this.selectedIds.filter(id => id !== item.id);
    }

    this.cdr.detectChanges();
  }

  toggleSelectAllFiltered(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    if (checked) {
      const filteredIds = this.filteredNotifications.map(item => item.id);
      this.selectedIds = Array.from(new Set([...this.selectedIds, ...filteredIds]));
    } else {
      const filteredIds = new Set(this.filteredNotifications.map(item => item.id));
      this.selectedIds = this.selectedIds.filter(id => !filteredIds.has(id));
    }

    this.cdr.detectChanges();
  }

  areAllFilteredSelected(): boolean {
    if (this.filteredNotifications.length === 0) {
      return false;
    }

    return this.filteredNotifications.every(item => this.selectedIds.includes(item.id));
  }

  isSelected(item: UserNotificationDto): boolean {
    return this.selectedIds.includes(item.id);
  }

  getTypeLabel(type: string): string {
    switch ((type || '').toUpperCase()) {
      case 'PROFILE':
        return 'Profil';
      case 'SECURITY':
        return 'Sécurité';
      case 'RECLAMATION':
        return 'Réclamation';
      case 'SYSTEM':
        return 'Système';
      case 'ARCHIVE':
        return 'Historique';
      case 'ACCESS_REQUEST':
        return 'Demande d’accès';
      default:
        return 'Autre';
    }
  }

  getTypeClass(type: string): string {
    switch ((type || '').toUpperCase()) {
      case 'PROFILE':
        return 'profile';
      case 'SECURITY':
        return 'security';
      case 'RECLAMATION':
        return 'reclamation';
      case 'SYSTEM':
        return 'system';
      case 'ARCHIVE':
        return 'archive';
      case 'ACCESS_REQUEST':
        return 'access-request';
      default:
        return 'other';
    }
  }

  getTypeInitial(type: string): string {
    switch ((type || '').toUpperCase()) {
      case 'PROFILE':
        return 'P';
      case 'SECURITY':
        return 'S';
      case 'RECLAMATION':
        return 'R';
      case 'SYSTEM':
        return 'SYS';
      case 'ARCHIVE':
        return 'H';
      case 'ACCESS_REQUEST':
        return 'DA';
      default:
        return 'A';
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken() || localStorage.getItem('token');

    if (!token) {
      return new HttpHeaders();
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  private normalizeText(value: string | null | undefined): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private showSuccess(message: string): void {
    this.successMessage = message;
    this.errorMessage = '';
    this.cdr.detectChanges();

    setTimeout(() => {
      this.successMessage = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  private getErrorMessage(error: any, fallback: string): string {
    if (typeof error?.error === 'string' && error.error.trim()) {
      return error.error;
    }

    if (error?.error?.message) {
      return error.error.message;
    }

    if (error?.error?.title) {
      return error.error.title;
    }

    if (error?.status === 403) {
      return "Action interdite : vous n'avez pas les droits nécessaires.";
    }

    if (error?.status === 401) {
      return 'Session expirée ou utilisateur non authentifié.';
    }

    return fallback;
  }
}