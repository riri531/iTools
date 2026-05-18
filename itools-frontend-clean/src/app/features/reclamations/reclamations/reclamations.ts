import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth';

interface ReclamationHistoryDto {
  id: number;
  reclamationId: number;
  actionByUserId: number;
  actionByUserName: string;
  action: string;
  oldStatus: string;
  newStatus: string;
  comment: string;
  createdAt: string;
}

interface ReclamationDto {
  id: number;
  title: string;
  problemType: string;
  description: string;
  reclamationDate: string;
  sourcePage: string;
  entityName: string;
  entityId: number | null;
  entityLabel: string;
  status: string;
  priority: string;
  assignedToRole: string;
  assignedToUserId: number | null;
  assignedToUserName: string;
  createdByUserId: number;
  createdByUserName: string;
  createdByUserRole: string;
  decision: string | null;
  resolution: string | null;
  treatedAt: string | null;
  treatedByUserId: number | null;
  treatedByUserName: string;
  createdAt: string;
  updatedAt: string;
  histories: ReclamationHistoryDto[];
  isRead?: boolean | null;
}

type ReclamationTab = 'ALL' | 'MINE' | 'ASSIGNED' | 'PENDING' | 'CLOSED';
type ReadFilter = 'ALL' | 'READ' | 'UNREAD';

@Component({
  selector: 'app-reclamations',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIf, NgFor, NgClass, DatePipe],
  templateUrl: './reclamations.html',
  styleUrl: './reclamations.scss'
})
export class ReclamationsComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  private apiUrl = 'http://localhost:5160/api/Reclamations';
  private readStorageKey = 'itools_read_reclamations';

  reclamations: ReclamationDto[] = [];
  filteredReclamations: ReclamationDto[] = [];

  selectedReclamation: ReclamationDto | null = null;

  activeTab: ReclamationTab = 'ASSIGNED';
  responsableView: 'EMPLOYES' | 'MINE' = 'EMPLOYES';

  searchText = '';
  selectedStatus = '';
  selectedPriority = '';
  selectedReadFilter: ReadFilter = 'ALL';
  selectedEntityFilter = '';

  isLoading = false;
  successMessage = '';
  errorMessage = '';

  startModalOpen = false;
  escalateModalOpen = false;
  treatModalOpen = false;

  private readReclamationIds = new Set<number>();

  startForm = {
    comment: ''
  };

  escalateForm = {
    reason: '',
    priority: 'HAUTE'
  };

  treatForm = {
    decision: '',
    resolution: '',
    status: 'TRAITEE'
  };

  statusOptions = [
    'EN_ATTENTE',
    'EN_COURS',
    'ESCALADEE_ADMIN',
    'TRAITEE',
    'REFUSEE',
    'CLOTUREE'
  ];

  priorityOptions = [
    'BASSE',
    'NORMALE',
    'HAUTE',
    'URGENTE'
  ];

  entityFilterOptions = [
    { value: 'LIGNE', label: 'Lignes' },
    { value: 'DESIGNATION', label: 'Désignations' },
    { value: 'FOURNISSEUR', label: 'Fournisseurs' },
    { value: 'OUTIL', label: 'Outils' },
    { value: 'MATIERE', label: 'Matières' },
    { value: 'EMPLACEMENT', label: 'Emplacements' },
    { value: 'CLIENT', label: 'Clients' },
    { value: 'UTILISATEUR', label: 'Utilisateurs' },
    { value: 'DASHBOARD', label: 'Dashboard' },
    { value: 'AUTRE', label: 'Autres' }
  ];

  ngOnInit(): void {
    this.loadReadState();

    if (this.isAdmin) {
      this.activeTab = 'ASSIGNED';
    }

    if (this.isEmploye) {
      this.activeTab = 'MINE';
    }

    if (this.isResponsable) {
      this.activeTab = 'ASSIGNED';
      this.responsableView = 'EMPLOYES';
    }

    this.loadReclamations();
  }

  get role(): string {
    return this.authService.getRole() || '';
  }

  get fullName(): string {
    return this.authService.getFullName() || '';
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  get isResponsable(): boolean {
    return this.role === 'RESPONSABLE';
  }

  get isEmploye(): boolean {
    return this.role === 'EMPLOYE';
  }

  get canSeeAssignedTab(): boolean {
    return this.isAdmin || this.isResponsable;
  }

  get readCount(): number {
    return this.reclamations.filter(item => this.isReclamationRead(item)).length;
  }

  get unreadCount(): number {
    return this.reclamations.filter(item => !this.isReclamationRead(item)).length;
  }

  loadReclamations(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<ReclamationDto[]>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.reclamations = data || [];
        this.applyFilters();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(err, 'Erreur lors du chargement des réclamations.');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  setResponsableView(view: 'EMPLOYES' | 'MINE'): void {
    this.responsableView = view;
    this.activeTab = view === 'EMPLOYES' ? 'ASSIGNED' : 'MINE';
    this.selectedReclamation = null;
    this.applyFilters();
  }

  setTab(tab: ReclamationTab): void {
    this.activeTab = tab;

    if (this.isResponsable) {
      if (tab === 'MINE') {
        this.responsableView = 'MINE';
      }

      if (tab === 'ASSIGNED') {
        this.responsableView = 'EMPLOYES';
      }
    }

    this.selectedReclamation = null;
    this.applyFilters();
  }

  applyFilters(): void {
    const search = this.normalizeText(this.searchText);

    this.filteredReclamations = this.reclamations.filter((item) => {
      const matchesSearch =
        !search ||
        this.normalizeText(item.title).includes(search) ||
        this.normalizeText(item.problemType).includes(search) ||
        this.normalizeText(item.description).includes(search) ||
        this.normalizeText(item.sourcePage).includes(search) ||
        this.normalizeText(item.entityName).includes(search) ||
        this.normalizeText(item.entityLabel).includes(search) ||
        this.normalizeText(item.createdByUserName).includes(search) ||
        this.normalizeText(item.assignedToRole).includes(search) ||
        this.normalizeText(item.status).includes(search) ||
        this.normalizeText(item.priority).includes(search);

      const matchesStatus =
        !this.selectedStatus || item.status === this.selectedStatus;

      const matchesPriority =
        !this.selectedPriority || item.priority === this.selectedPriority;

      const matchesRead =
        this.selectedReadFilter === 'ALL' ||
        (this.selectedReadFilter === 'READ' && this.isReclamationRead(item)) ||
        (this.selectedReadFilter === 'UNREAD' && !this.isReclamationRead(item));

      const matchesEntity =
        !this.selectedEntityFilter ||
        this.getEntityType(item) === this.selectedEntityFilter;

      const matchesTab = this.matchesActiveTab(item);

      return matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesRead &&
        matchesEntity &&
        matchesTab;
    });

    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.searchText = '';
    this.selectedStatus = '';
    this.selectedPriority = '';
    this.selectedReadFilter = 'ALL';
    this.selectedEntityFilter = '';
    this.applyFilters();
  }

  selectReclamation(item: ReclamationDto): void {
    if (this.selectedReclamation?.id === item.id) {
      this.selectedReclamation = null;
    } else {
      this.selectedReclamation = item;
    }

    this.cdr.detectChanges();
  }

  markAsRead(item: ReclamationDto): void {
    this.readReclamationIds.add(item.id);
    item.isRead = true;
    this.saveReadState();

    this.showSuccess('Réclamation marquée comme lue.');
    this.applyFilters();
  }

  isReclamationRead(item: ReclamationDto): boolean {
    return item.isRead === true || this.readReclamationIds.has(item.id);
  }

  openStartModal(item: ReclamationDto): void {
    if (!this.canStart(item)) {
      this.showError("Vous n'avez pas le droit de commencer le traitement de cette réclamation.");
      return;
    }

    this.selectedReclamation = item;
    this.startForm = {
      comment: ''
    };
    this.errorMessage = '';
    this.startModalOpen = true;
    this.cdr.detectChanges();
  }

  openEscalateModal(item: ReclamationDto): void {
    if (!this.canEscalate(item)) {
      this.showError("Vous n'avez pas le droit d'escalader cette réclamation.");
      return;
    }

    this.selectedReclamation = item;
    this.escalateForm = {
      reason: '',
      priority: 'HAUTE'
    };
    this.errorMessage = '';
    this.escalateModalOpen = true;
    this.cdr.detectChanges();
  }

  openTreatModal(item: ReclamationDto, status: 'TRAITEE' | 'REFUSEE' | 'CLOTUREE' = 'TRAITEE'): void {
    if (!this.canTreat(item)) {
      this.showError("Vous n'avez pas le droit de traiter cette réclamation.");
      return;
    }

    this.selectedReclamation = item;
    this.treatForm = {
      decision: '',
      resolution: '',
      status
    };
    this.errorMessage = '';
    this.treatModalOpen = true;
    this.cdr.detectChanges();
  }

  closeModals(): void {
    this.startModalOpen = false;
    this.escalateModalOpen = false;
    this.treatModalOpen = false;
    this.cdr.detectChanges();
  }

  startTreatment(): void {
    if (!this.selectedReclamation) {
      return;
    }

    if (!this.canStart(this.selectedReclamation)) {
      this.showError("Vous n'avez pas le droit de commencer le traitement de cette réclamation.");
      return;
    }

    const payload = {
      comment: this.startForm.comment.trim()
    };

    this.http.put(`${this.apiUrl}/${this.selectedReclamation.id}/start`, payload, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showSuccess('Traitement commencé avec succès.');
        this.closeModals();
        this.loadReclamations();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(err, 'Erreur lors du début de traitement.');
        this.cdr.detectChanges();
      }
    });
  }

  escalateToAdmin(): void {
    if (!this.selectedReclamation) {
      return;
    }

    if (!this.canEscalate(this.selectedReclamation)) {
      this.showError("Vous n'avez pas le droit d'escalader cette réclamation.");
      return;
    }

    if (!this.escalateForm.reason.trim()) {
      this.errorMessage = 'La raison de l’escalade est obligatoire.';
      this.cdr.detectChanges();
      return;
    }

    const payload = {
      reason: this.escalateForm.reason.trim(),
      priority: this.escalateForm.priority
    };

    this.http.put(`${this.apiUrl}/${this.selectedReclamation.id}/escalate`, payload, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showSuccess('Réclamation escaladée vers ADMIN.');
        this.closeModals();
        this.loadReclamations();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(err, 'Erreur lors de l’escalade.');
        this.cdr.detectChanges();
      }
    });
  }

  treatReclamation(): void {
    if (!this.selectedReclamation) {
      return;
    }

    if (!this.canTreat(this.selectedReclamation)) {
      this.showError("Vous n'avez pas le droit de traiter cette réclamation.");
      return;
    }

    if (!this.treatForm.decision.trim()) {
      this.errorMessage = 'La décision est obligatoire.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.treatForm.resolution.trim()) {
      this.errorMessage = 'La résolution est obligatoire.';
      this.cdr.detectChanges();
      return;
    }

    const payload = {
      decision: this.treatForm.decision.trim(),
      resolution: this.treatForm.resolution.trim(),
      status: this.treatForm.status
    };

    this.http.put(`${this.apiUrl}/${this.selectedReclamation.id}/treat`, payload, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showSuccess('Réclamation traitée avec succès.');
        this.closeModals();
        this.loadReclamations();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(err, 'Erreur lors du traitement.');
        this.cdr.detectChanges();
      }
    });
  }

  deleteReclamation(item: ReclamationDto): void {
    if (!this.canDelete(item)) {
      this.showError("Vous n'avez pas le droit de supprimer cette réclamation.");
      return;
    }

    const confirmed = confirm(`Supprimer la réclamation "${item.title}" ?`);

    if (!confirmed) {
      return;
    }

    this.http.delete(`${this.apiUrl}/${item.id}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showSuccess('Réclamation supprimée.');
        this.selectedReclamation = null;
        this.readReclamationIds.delete(item.id);
        this.saveReadState();
        this.loadReclamations();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(err, 'Erreur lors de la suppression.');
        this.cdr.detectChanges();
      }
    });
  }

  canStart(item: ReclamationDto): boolean {
    if (this.isClosed(item)) {
      return false;
    }

    if (this.isCreator(item)) {
      return false;
    }

    if (this.isAdmin) {
      return item.assignedToRole === 'ADMIN' &&
        item.createdByUserRole === 'RESPONSABLE' &&
        (item.status === 'EN_ATTENTE' || item.status === 'ESCALADEE_ADMIN');
    }

    if (this.isResponsable) {
      return item.assignedToRole === 'RESPONSABLE' &&
        item.createdByUserRole === 'EMPLOYE' &&
        item.status === 'EN_ATTENTE';
    }

    return false;
  }

  canEscalate(item: ReclamationDto): boolean {
    if (!this.isResponsable) {
      return false;
    }

    if (this.isClosed(item)) {
      return false;
    }

    if (this.isCreator(item)) {
      return false;
    }

    return item.assignedToRole === 'RESPONSABLE' &&
      item.createdByUserRole === 'EMPLOYE';
  }

  canTreat(item: ReclamationDto): boolean {
    if (this.isClosed(item)) {
      return false;
    }

    if (this.isCreator(item)) {
      return false;
    }

    if (this.isAdmin) {
      return item.assignedToRole === 'ADMIN' &&
        item.createdByUserRole === 'RESPONSABLE';
    }

    if (this.isResponsable) {
      return item.assignedToRole === 'RESPONSABLE' &&
        item.createdByUserRole === 'EMPLOYE';
    }

    return false;
  }

  canDelete(item: ReclamationDto): boolean {
    return this.isAdmin && item.assignedToRole === 'ADMIN';
  }

  canShowActions(item: ReclamationDto): boolean {
    return this.canStart(item) ||
      this.canEscalate(item) ||
      this.canTreat(item) ||
      this.canDelete(item);
  }

  isCreator(item: ReclamationDto): boolean {
    return item.createdByUserName === this.fullName;
  }

  isClosed(item: ReclamationDto): boolean {
    return item.status === 'TRAITEE' ||
      item.status === 'REFUSEE' ||
      item.status === 'CLOTUREE';
  }

  getRoleInfoText(): string {
    if (this.isAdmin) {
      return 'Admin : vous traitez uniquement les réclamations transmises par les responsables.';
    }

    if (this.isResponsable) {
      if (this.responsableView === 'EMPLOYES') {
        return 'Responsable : vous consultez les réclamations des employés à traiter.';
      }

      return 'Responsable : vous consultez vos propres réclamations envoyées aux admins pour suivi.';
    }

    return 'Employé : vous pouvez suivre l’état de vos réclamations.';
  }

  getListTitle(): string {
    if (this.isResponsable && this.responsableView === 'EMPLOYES') {
      return 'Réclamations des employés à traiter';
    }

    if (this.isResponsable && this.responsableView === 'MINE') {
      return 'Mes réclamations envoyées à l’admin';
    }

    if (this.isAdmin) {
      return 'Réclamations des responsables à traiter';
    }

    return 'Mes réclamations';
  }

  getEntityType(item: ReclamationDto): string {
    const raw = this.normalizeText([
      item.sourcePage,
      item.entityName,
      item.entityLabel,
      item.problemType,
      item.title
    ].join(' '));

    if (raw.includes('ligne')) {
      return 'LIGNE';
    }

    if (raw.includes('designation') || raw.includes('désignation')) {
      return 'DESIGNATION';
    }

    if (raw.includes('fournisseur')) {
      return 'FOURNISSEUR';
    }

    if (raw.includes('outil') || raw.includes('outillage')) {
      return 'OUTIL';
    }

    if (raw.includes('matiere') || raw.includes('matière')) {
      return 'MATIERE';
    }

    if (raw.includes('emplacement')) {
      return 'EMPLACEMENT';
    }

    if (raw.includes('client')) {
      return 'CLIENT';
    }

    if (raw.includes('user') || raw.includes('utilisateur')) {
      return 'UTILISATEUR';
    }

    if (raw.includes('dashboard') || raw.includes('tableau')) {
      return 'DASHBOARD';
    }

    return 'AUTRE';
  }

  getEntityTypeLabel(item: ReclamationDto): string {
    const type = this.getEntityType(item);
    const found = this.entityFilterOptions.find(option => option.value === type);

    return found ? found.label : 'Autres';
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'EN_ATTENTE':
        return 'En attente';
      case 'EN_COURS':
        return 'En cours';
      case 'ESCALADEE_ADMIN':
        return 'Escaladée admin';
      case 'TRAITEE':
        return 'Traitée';
      case 'REFUSEE':
        return 'Refusée';
      case 'CLOTUREE':
        return 'Clôturée';
      default:
        return status;
    }
  }

  getPriorityLabel(priority: string): string {
    switch (priority) {
      case 'BASSE':
        return 'Basse';
      case 'NORMALE':
        return 'Normale';
      case 'HAUTE':
        return 'Haute';
      case 'URGENTE':
        return 'Urgente';
      default:
        return priority;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'EN_ATTENTE':
        return 'pending';
      case 'EN_COURS':
        return 'progress';
      case 'ESCALADEE_ADMIN':
        return 'escalated';
      case 'TRAITEE':
        return 'treated';
      case 'REFUSEE':
        return 'refused';
      case 'CLOTUREE':
        return 'closed';
      default:
        return 'default';
    }
  }

  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'BASSE':
        return 'low';
      case 'NORMALE':
        return 'normal';
      case 'HAUTE':
        return 'high';
      case 'URGENTE':
        return 'urgent';
      default:
        return 'normal';
    }
  }

  getActionLabel(action: string): string {
    switch (action) {
      case 'CREATE':
        return 'Création';
      case 'START_TREATMENT':
        return 'Début traitement';
      case 'ESCALATE_TO_ADMIN':
        return 'Escalade admin';
      case 'TREAT':
        return 'Traitement';
      default:
        return action;
    }
  }

  private matchesActiveTab(item: ReclamationDto): boolean {
    if (this.isResponsable) {
      if (this.responsableView === 'EMPLOYES') {
        const isEmployeReclamation =
          item.assignedToRole === 'RESPONSABLE' &&
          item.createdByUserRole === 'EMPLOYE' &&
          !this.isCreator(item);

        if (!isEmployeReclamation) {
          return false;
        }
      }

      if (this.responsableView === 'MINE') {
        const isMyReclamation = this.isCreator(item);

        if (!isMyReclamation) {
          return false;
        }
      }
    }

    switch (this.activeTab) {
      case 'ALL':
        return true;

      case 'MINE':
        return this.isCreator(item);

      case 'ASSIGNED':
        if (this.isAdmin) {
          return item.assignedToRole === 'ADMIN' &&
            item.createdByUserRole === 'RESPONSABLE';
        }

        if (this.isResponsable) {
          return item.assignedToRole === 'RESPONSABLE' &&
            item.createdByUserRole === 'EMPLOYE' &&
            !this.isCreator(item);
        }

        return false;

      case 'PENDING':
        return item.status === 'EN_ATTENTE' ||
          item.status === 'EN_COURS' ||
          item.status === 'ESCALADEE_ADMIN';

      case 'CLOSED':
        return this.isClosed(item);

      default:
        return true;
    }
  }

  private loadReadState(): void {
    try {
      const raw = localStorage.getItem(this.readStorageKey);
      const ids = raw ? JSON.parse(raw) : [];

      if (Array.isArray(ids)) {
        this.readReclamationIds = new Set(
          ids
            .map(value => Number(value))
            .filter(value => Number.isFinite(value))
        );
      }
    } catch {
      this.readReclamationIds = new Set<number>();
    }
  }

  private saveReadState(): void {
    localStorage.setItem(
      this.readStorageKey,
      JSON.stringify(Array.from(this.readReclamationIds))
    );
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

  private showError(message: string): void {
    this.errorMessage = message;
    this.successMessage = '';
    this.cdr.detectChanges();
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