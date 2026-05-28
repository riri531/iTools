import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
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
  message: string;
  status: string;
  decisionComment?: string | null;
  treatedByUserName?: string | null;
  createdAt: string;
  treatedAt?: string | null;
}

interface RoleDto {
  id: number;
  name: string;
}

type ReadFilter = 'ALL' | 'UNREAD' | 'READ';
type ActivePanel = 'PERSONAL' | 'ACCESS';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss'
})
export class NotificationsComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  private readonly baseUrl = 'http://localhost:5160/api';

  notifications: UserNotificationDto[] = [];
  filteredNotifications: UserNotificationDto[] = [];

  accessRequests: AccessRequestDto[] = [];
  roles: RoleDto[] = [];

  selectedIds: number[] = [];

  searchText = '';
  selectedType = '';
  selectedReadFilter: ReadFilter = 'ALL';
  activePanel: ActivePanel = 'PERSONAL';

  isLoading = false;
  isLoadingAccessRequests = false;

  successMessage = '';
  errorMessage = '';

  selectedAccessRequestId: number | null = null;
  selectedRoleId = 0;
  decisionComment = '';
  processingAccessRequestId: number | null = null;

  typeOptions: string[] = [
    'PROFILE',
    'SECURITY',
    'RECLAMATION',
    'ARCHIVE',
    'SYSTEM',
    'OTHER'
  ];

  ngOnInit(): void {
    this.loadNotifications();

    if (this.isAdmin()) {
      this.loadAccessRequests();
      this.loadRoles();
    }
  }

  get personalNotifications(): UserNotificationDto[] {
    return this.notifications.filter(item => !this.isAccessRequestNotification(item));
  }

  get personalNotificationsCount(): number {
    return this.personalNotifications.length;
  }

  get unreadCount(): number {
    return this.personalNotifications.filter(item => !item.isRead).length;
  }

  get readCount(): number {
    return this.personalNotifications.filter(item => item.isRead).length;
  }

  get pendingAccessRequestsCount(): number {
    return this.accessRequests.filter(item => item.status === 'EN_ATTENTE').length;
  }

  private get notificationsUrl(): string {
    return `${this.baseUrl}/Profile/notifications`;
  }

  private get accessRequestsUrl(): string {
    return `${this.baseUrl}/AccessRequests`;
  }

  private get rolesUrl(): string {
    return `${this.baseUrl}/Roles`;
  }

  getAuthHeaders(): HttpHeaders {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('authToken') ||
      localStorage.getItem('jwt') ||
      '';

    if (!token) {
      return new HttpHeaders();
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }

  isAdmin(): boolean {
    const role =
      localStorage.getItem('role') ||
      localStorage.getItem('userRole') ||
      localStorage.getItem('Role') ||
      localStorage.getItem('UserRole') ||
      '';

    return this.normalizeText(role) === 'admin';
  }

  setActivePanel(panel: ActivePanel): void {
    this.activePanel = panel;
    this.successMessage = '';
    this.errorMessage = '';

    if (panel === 'PERSONAL') {
      this.loadNotifications();
      return;
    }

    if (panel === 'ACCESS' && this.isAdmin()) {
      this.loadAccessRequests();
      this.loadRoles();
    }
  }

  loadNotifications(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<UserNotificationDto[]>(this.notificationsUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        console.log('Notifications reçues :', data);

        this.notifications = (data || []).map(item => ({
          id: item.id,
          title: item.title || 'Notification',
          message: item.message || '',
          type: item.type || 'OTHER',
          isRead: item.isRead === true,
          createdAt: item.createdAt
        }));

        this.selectedIds = [];
        this.applyFilters();

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur notifications :', err);

        this.notifications = [];
        this.filteredNotifications = [];
        this.selectedIds = [];

        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors du chargement des notifications.'
        );

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      complete: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadAccessRequests(): void {
    if (!this.isAdmin()) {
      return;
    }

    this.isLoadingAccessRequests = true;
    this.errorMessage = '';

    this.http.get<AccessRequestDto[]>(this.accessRequestsUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.accessRequests = (data || []).map(item => ({
          ...item,
          status: item.status || 'EN_ATTENTE'
        }));

        this.isLoadingAccessRequests = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur demandes accès :', err);

        this.accessRequests = [];
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors du chargement des demandes d’accès.'
        );

        this.isLoadingAccessRequests = false;
        this.cdr.detectChanges();
      },
      complete: () => {
        this.isLoadingAccessRequests = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadRoles(): void {
    if (!this.isAdmin()) {
      return;
    }

    this.http.get<RoleDto[]>(this.rolesUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.roles = data || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur rôles :', err);

        this.roles = [];

        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors du chargement des rôles.'
        );

        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    const search = this.normalizeText(this.searchText);

    this.filteredNotifications = this.personalNotifications.filter(item => {
      const itemType = item.type || 'OTHER';

      const matchesSearch =
        !search ||
        this.normalizeText(item.title).includes(search) ||
        this.normalizeText(item.message).includes(search) ||
        this.normalizeText(itemType).includes(search) ||
        this.normalizeText(this.getTypeLabel(itemType)).includes(search);

      const matchesRead =
        this.selectedReadFilter === 'ALL' ||
        (this.selectedReadFilter === 'READ' && item.isRead) ||
        (this.selectedReadFilter === 'UNREAD' && !item.isRead);

      const matchesType =
        !this.selectedType || itemType === this.selectedType;

      return matchesSearch && matchesRead && matchesType;
    });

    this.selectedIds = this.selectedIds.filter(id =>
      this.filteredNotifications.some(item => item.id === id)
    );

    this.cdr.detectChanges();
  }

  setReadFilter(filter: ReadFilter): void {
    this.selectedReadFilter = filter;
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchText = '';
    this.selectedType = '';
    this.selectedReadFilter = 'ALL';
    this.applyFilters();
  }

  markAsRead(item: UserNotificationDto): void {
    if (!item || item.isRead) {
      return;
    }

    this.http.put(`${this.notificationsUrl}/${item.id}/read`, {}, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        item.isRead = true;

        const original = this.notifications.find(notification => notification.id === item.id);
        if (original) {
          original.isRead = true;
        }

        this.applyFilters();
      },
      error: (err) => {
        console.error('Erreur marquer comme lu :', err);

        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors du marquage de la notification comme lue.'
        );

        this.cdr.detectChanges();
      }
    });
  }

  markSelectedAsRead(): void {
    if (this.selectedIds.length === 0) {
      return;
    }

    const ids = [...this.selectedIds];

    this.http.put(`${this.notificationsUrl}/mark-read`, ids, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.notifications = this.notifications.map(item => ({
          ...item,
          isRead: ids.includes(item.id) ? true : item.isRead
        }));

        this.selectedIds = [];
        this.successMessage = 'Sélection marquée comme lue avec succès.';
        this.applyFilters();
        this.clearMessagesLater();
      },
      error: (err) => {
        console.error('Erreur marquer sélection :', err);

        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors du marquage de la sélection.'
        );

        this.cdr.detectChanges();
      }
    });
  }

  deleteNotification(item: UserNotificationDto): void {
    if (!item) {
      return;
    }

    const confirmed = window.confirm('Supprimer cette notification ?');

    if (!confirmed) {
      return;
    }

    this.http.delete(`${this.notificationsUrl}/${item.id}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(notification => notification.id !== item.id);
        this.filteredNotifications = this.filteredNotifications.filter(notification => notification.id !== item.id);
        this.selectedIds = this.selectedIds.filter(id => id !== item.id);

        this.successMessage = 'Notification supprimée avec succès.';
        this.applyFilters();
        this.clearMessagesLater();
      },
      error: (err) => {
        console.error('Erreur suppression notification :', err);

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

    const confirmed = window.confirm('Supprimer les notifications sélectionnées ?');

    if (!confirmed) {
      return;
    }

    const ids = [...this.selectedIds];

    this.http.request('delete', `${this.notificationsUrl}/bulk`, {
      body: ids,
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(item => !ids.includes(item.id));
        this.selectedIds = [];

        this.successMessage = 'Notifications sélectionnées supprimées avec succès.';
        this.applyFilters();
        this.clearMessagesLater();
      },
      error: (err) => {
        console.error('Erreur suppression sélection :', err);

        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors de la suppression de la sélection.'
        );

        this.cdr.detectChanges();
      }
    });
  }

  deleteAllNotifications(): void {
    if (this.personalNotifications.length === 0) {
      return;
    }

    const confirmed = window.confirm('Supprimer toutes les notifications personnelles ?');

    if (!confirmed) {
      return;
    }

    const personalIds = this.personalNotifications.map(item => item.id);

    this.http.request('delete', `${this.notificationsUrl}/bulk`, {
      body: personalIds,
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(item => !personalIds.includes(item.id));
        this.filteredNotifications = [];
        this.selectedIds = [];

        this.successMessage = 'Toutes les notifications personnelles ont été supprimées.';
        this.applyFilters();
        this.clearMessagesLater();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Erreur suppression totale :', err);

        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors de la suppression des notifications personnelles.'
        );

        this.cdr.detectChanges();
      }
    });
  }

  toggleSelection(item: UserNotificationDto, event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.checked) {
      if (!this.selectedIds.includes(item.id)) {
        this.selectedIds = [...this.selectedIds, item.id];
      }
    } else {
      this.selectedIds = this.selectedIds.filter(id => id !== item.id);
    }
  }

  isSelected(item: UserNotificationDto): boolean {
    return this.selectedIds.includes(item.id);
  }

  areAllFilteredSelected(): boolean {
    return (
      this.filteredNotifications.length > 0 &&
      this.filteredNotifications.every(item => this.selectedIds.includes(item.id))
    );
  }

  toggleSelectAllFiltered(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.checked) {
      const filteredIds = this.filteredNotifications.map(item => item.id);
      this.selectedIds = Array.from(new Set([...this.selectedIds, ...filteredIds]));
    } else {
      const filteredIds = this.filteredNotifications.map(item => item.id);
      this.selectedIds = this.selectedIds.filter(id => !filteredIds.includes(id));
    }
  }

  selectAccessRequest(request: AccessRequestDto): void {
    this.selectedAccessRequestId = request.id;
    this.selectedRoleId = this.roles.length > 0 ? this.roles[0].id : 0;
    this.decisionComment = '';
  }

  cancelAccessRequestSelection(): void {
    this.selectedAccessRequestId = null;
    this.selectedRoleId = 0;
    this.decisionComment = '';
  }

  approveAccessRequest(request: AccessRequestDto): void {
    if (!request) {
      return;
    }

    if (!this.selectedRoleId || this.selectedRoleId === 0) {
      this.errorMessage = 'Veuillez choisir un rôle avant d’accepter la demande.';
      this.cdr.detectChanges();
      return;
    }

    this.processingAccessRequestId = request.id;
    this.errorMessage = '';
    this.successMessage = '';

    const body = {
      roleId: this.selectedRoleId,
      decisionComment: this.decisionComment || 'Demande acceptée.'
    };

    this.http.put(`${this.accessRequestsUrl}/${request.id}/approve`, body, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.successMessage = 'Demande acceptée. Un email de confirmation a été envoyé.';
        this.processingAccessRequestId = null;
        this.cancelAccessRequestSelection();

        this.loadAccessRequests();
        this.loadNotifications();

        this.clearMessagesLater();
      },
      error: (err) => {
        console.error('Erreur acceptation demande :', err);

        this.processingAccessRequestId = null;
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors de l’acceptation de la demande.'
        );

        this.cdr.detectChanges();
      }
    });
  }

  rejectAccessRequest(request: AccessRequestDto): void {
    if (!request) {
      return;
    }

    const confirmed = window.confirm('Refuser cette demande d’accès ?');

    if (!confirmed) {
      return;
    }

    this.processingAccessRequestId = request.id;
    this.errorMessage = '';
    this.successMessage = '';

    const body = {
      decisionComment: this.decisionComment || 'Demande refusée.'
    };

    this.http.put(`${this.accessRequestsUrl}/${request.id}/reject`, body, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.successMessage = 'Demande refusée.';
        this.processingAccessRequestId = null;
        this.cancelAccessRequestSelection();

        this.loadAccessRequests();
        this.loadNotifications();

        this.clearMessagesLater();
      },
      error: (err) => {
        console.error('Erreur refus demande :', err);

        this.processingAccessRequestId = null;
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors du refus de la demande.'
        );

        this.cdr.detectChanges();
      }
    });
  }

  isAccessRequestNotification(item: UserNotificationDto): boolean {
    return this.isAccessRequestType(item?.type);
  }

  isAccessRequestType(type: string | null | undefined): boolean {
    const normalized = this.normalizeText(type);

    return (
      normalized === 'access_request' ||
      normalized === 'accessrequest' ||
      normalized === 'demande_acces' ||
      normalized === 'demande acces' ||
      normalized === 'demandeaccess'
    );
  }

  getTypeLabel(type: string): string {
    const normalized = this.normalizeText(type);

    switch (normalized) {
      case 'profile':
        return 'Profil';
      case 'security':
        return 'Sécurité';
      case 'reclamation':
        return 'Réclamation';
      case 'archive':
        return 'Archive';
      case 'system':
        return 'Système';
      case 'access_request':
      case 'accessrequest':
      case 'demande_acces':
      case 'demande acces':
        return 'Demande accès';
      default:
        return 'Autre';
    }
  }

  getTypeInitial(type: string): string {
    const label = this.getTypeLabel(type);
    return label.charAt(0).toUpperCase();
  }

  getTypeClass(type: string): string {
    const normalized = this.normalizeText(type);

    switch (normalized) {
      case 'profile':
        return 'profile';
      case 'security':
        return 'security';
      case 'reclamation':
        return 'reclamation';
      case 'archive':
        return 'archive';
      case 'system':
        return 'system';
      case 'access_request':
      case 'accessrequest':
      case 'demande_acces':
      case 'demande acces':
        return 'access-request';
      default:
        return 'other';
    }
  }

  getAccessStatusLabel(status: string): string {
    const normalized = this.normalizeText(status);

    switch (normalized) {
      case 'en_attente':
      case 'pending':
        return 'En attente';
      case 'acceptee':
      case 'accepted':
        return 'Acceptée';
      case 'refusee':
      case 'rejected':
        return 'Refusée';
      default:
        return status || 'Non renseigné';
    }
  }

  getAccessStatusClass(status: string): string {
    const normalized = this.normalizeText(status);

    switch (normalized) {
      case 'en_attente':
      case 'pending':
        return 'pending';
      case 'acceptee':
      case 'accepted':
        return 'accepted';
      case 'refusee':
      case 'rejected':
        return 'rejected';
      default:
        return 'other';
    }
  }

  normalizeText(value: string | null | undefined): string {
    return (value || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  getErrorMessage(error: any, fallback: string): string {
    if (error?.error?.message) {
      return error.error.message;
    }

    if (typeof error?.error === 'string') {
      return error.error;
    }

    if (error?.message) {
      return error.message;
    }

    return fallback;
  }

  private clearMessagesLater(): void {
    window.setTimeout(() => {
      this.successMessage = '';
      this.errorMessage = '';
      this.cdr.detectChanges();
    }, 3500);
  }
}