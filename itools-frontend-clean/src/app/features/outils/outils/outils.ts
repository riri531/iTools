import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { AuthService } from '../../../core/services/auth';

interface LigneItem {
  id: number;
  nom: string;
}

interface ClientItem {
  id: number;
  nomClient: string;
  nomFamille: string;
  nomReference: string;
}

interface FournisseurItem {
  id: number;
  codeFournisseur: string;
  nomFournisseur: string;
}

interface MatiereItem {
  id: number;
  nomMatiere: string;
  process: string;
}

interface DesignationItem {
  id: number;
  name: string;
  imageUrl?: string | null;
  photoUrl?: string | null;
  image?: string | null;
}

interface EmplacementItem {
  id: number;
  matiereId: number;
  matiere?: MatiereItem;
  armoire: string;
  numero: string;
  designationId: number;
  designation?: DesignationItem;
  status: string;
}

interface OutilItem {
  id: number;
  ligneId: number;
  ligne?: LigneItem;
  clientId: number;
  client?: ClientItem;
  fournisseurId: number;
  fournisseur?: FournisseurItem;
  emplacementId: number;
  emplacement?: EmplacementItem;
  ott: string;
  codeOutillage: string;
  status: string;
  valeur: number;
  justificationHS?: string;
  dateAffectation?: string;

  imageUrl?: string | null;
  photoUrl?: string | null;
  image?: string | null;

  updatedAt?: string | null;
  createdAt?: string | null;
  creationDate?: string | null;
  createdOn?: string | null;
  createdDate?: string | null;
  dateCreation?: string | null;
}

interface CreateOutilRequest {
  ligneId: number;
  clientId: number;
  fournisseurId: number;
  emplacementId: number;
  ott: string;
  codeOutillage: string;
  status: string;
  valeur: number;
  justificationHS?: string;
  dateAffectation?: string;
  createdAt?: string;
}

interface UpdateOutilRequest {
  ligneId: number;
  clientId: number;
  fournisseurId: number;
  emplacementId: number;
  ott: string;
  codeOutillage: string;
  status: string;
  valeur: number;
  justificationHS?: string;
  dateAffectation?: string;
  createdAt?: string;
}

interface CreateReclamationRequest {
  title: string;
  problemType: string;
  description: string;
  reclamationDate: string;
  sourcePage: string;
  entityName: string;
  entityId: number | null;
  entityLabel: string;
  priority: string;
}

type OutilViewMode = 'list' | 'images';
type SortField = 'codeOutillage' | 'ott' | 'dateCreation';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-outils',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  templateUrl: './outils.html',
  styleUrl: './outils.scss'
})
export class OutilsComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private apiUrl = 'http://localhost:5160/api/Outils';
  private lignesUrl = 'http://localhost:5160/api/Lignes';
  private clientsUrl = 'http://localhost:5160/api/Clients';
  private fournisseursUrl = 'http://localhost:5160/api/Fournisseurs';
  private emplacementsUrl = 'http://localhost:5160/api/Emplacements';
  private designationsUrl = 'http://localhost:5160/api/Designations';
  private reclamationsUrl = 'http://localhost:5160/api/Reclamations';
  private baseUrl = 'http://localhost:5160';

  private viewModeStorageKey = 'itools_outils_view_mode';
  private sortFieldStorageKey = 'itools_outils_sort_field';
  private sortDirectionStorageKey = 'itools_outils_sort_direction';

  outils: OutilItem[] = [];
  filteredOutils: OutilItem[] = [];

  lignes: LigneItem[] = [];
  clients: ClientItem[] = [];
  fournisseurs: FournisseurItem[] = [];
  emplacements: EmplacementItem[] = [];

  designationContextId: number | null = null;
  designationContextName = '';

  viewMode: OutilViewMode = 'list';

  searchText = '';
  selectedLigne = '';
  selectedClient = '';
  selectedFournisseur = '';
  selectedMatiere = '';
  selectedDesignation = '';
  selectedStatus = '';

  ligneFilterOptions: string[] = [];
  clientFilterOptions: string[] = [];
  fournisseurFilterOptions: string[] = [];
  matiereFilterOptions: string[] = [];
  designationFilterOptions: string[] = [];
  statusFilterOptions = ['S', 'HS'];

  sortField: SortField = 'codeOutillage';
  sortDirection: SortDirection = 'asc';

  outilsLoaded = false;
  lignesLoaded = false;
  clientsLoaded = false;
  fournisseursLoaded = false;
  emplacementsLoaded = false;

  showModal = false;
  showImportModal = false;
  showReclamationModal = false;

  selectedImportFile: File | null = null;
  importErrorMessage = '';
  importSuccessMessage = '';

  selectedReclamationOutil: OutilItem | null = null;
  reclamationErrorMessage = '';
  reclamationSuccessMessage = '';

  reclamationProblemTypes = [
    'Problème technique',
    'Outil hors service',
    'Outil épuisé',
    'Risque épuisement',
    'Erreur de données',
    'Emplacement incorrect',
    'Affectation incorrecte',
    'Autre'
  ];

  priorityOptions = [
    'BASSE',
    'NORMALE',
    'HAUTE',
    'URGENTE'
  ];

  reclamationForm = {
    title: '',
    problemType: 'Problème technique',
    description: '',
    reclamationDate: '',
    priority: 'NORMALE'
  };

  statusOptions = ['S', 'HS'];

  form = {
    id: 0,
    ligneId: 0,
    clientId: 0,
    fournisseurId: 0,
    emplacementId: 0,
    ott: '',
    codeOutillage: '',
    status: 'S',
    valeur: 0,
    justificationHS: '',
    dateAffectation: '',
    createdAt: '',
    imageUrl: '',
    imagePreview: '',
    imageFile: null as File | null,
    removeImage: false
  };

  isEditMode = false;
  successMessage = '';
  errorMessage = '';

  private successTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.initDesignationContext();
    this.restoreViewMode();
    this.restoreSortPreferences();
    this.loadDependencies();
    this.loadOutils();
  }

  canManageData(): boolean {
    const role = String(this.authService.getRole() || localStorage.getItem('role') || '').toUpperCase();
    return role === 'ADMIN' || role === 'RESPONSABLE';
  }
  canCreateReclamation(): boolean {
    const role = String(this.authService.getRole() || localStorage.getItem('role') || '').toUpperCase();
    return role === 'ADMIN' || role === 'RESPONSABLE';
  }
  canDownloadOutilCard(): boolean {
    const role = String(this.authService.getRole() || localStorage.getItem('role') || '').toUpperCase();
    return role === 'ADMIN' || role === 'RESPONSABLE' || role === 'EMPLOYE' || role === 'EMPLOYÉ';
  }


  isDesignationContext(): boolean {
    return this.designationContextId !== null;
  }

  getPageTitle(): string {
    if (!this.designationContextId) {
      return 'Outils';
    }

    return this.designationContextName
      ? `Outils - ${this.designationContextName}`
      : `Outils de la désignation ${this.designationContextId}`;
  }

  getPageSubtitle(): string {
    if (!this.designationContextId) {
      return 'Gestion des outillages, affectations, statuts, valeurs et emplacements.';
    }

    return 'Liste des outils liés à cette désignation. Les nouveaux outils créés ici seront rattachés à un emplacement qui porte cette désignation.';
  }

  goBackToDesignations(): void {
    this.router.navigate(['/app/designations']);
  }

  getFormEmplacements(): EmplacementItem[] {
    return this.getContextEmplacements();
  }


  private initDesignationContext(): void {
    const designationIdParam = this.route.snapshot.paramMap.get('designationId');
    const designationId = Number(designationIdParam);

    if (!Number.isNaN(designationId) && designationId > 0) {
      this.designationContextId = designationId;
      this.loadDesignationContextName(designationId);
    }
  }

  private loadDesignationContextName(designationId: number): void {
    this.http.get<DesignationItem>(`${this.designationsUrl}/${designationId}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: designation => {
        this.designationContextName = designation?.name || '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.designationContextName = '';
        this.cdr.detectChanges();
      }
    });
  }

  loadDependencies(): void {
    this.loadLignes();
    this.loadClients();
    this.loadFournisseurs();
    this.loadEmplacements();
  }

  loadOutils(): void {
    this.http.get<OutilItem[]>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.outils = data || [];
        this.outilsLoaded = true;
        this.refreshView();
      },
      error: (err: any) => {
        console.error('Erreur chargement outils :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des outils.'));
      }
    });
  }

  loadLignes(): void {
    this.http.get<LigneItem[]>(this.lignesUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.lignes = data || [];
        this.lignesLoaded = true;

        if (!this.form.ligneId && this.lignes.length > 0) {
          this.form.ligneId = this.lignes[0].id;
        }

        this.refreshView();
      },
      error: (err: any) => {
        console.error('Erreur chargement lignes :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des lignes.'));
      }
    });
  }

  loadClients(): void {
    this.http.get<ClientItem[]>(this.clientsUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.clients = data || [];
        this.clientsLoaded = true;

        if (!this.form.clientId && this.clients.length > 0) {
          this.form.clientId = this.clients[0].id;
        }

        this.refreshView();
      },
      error: (err: any) => {
        console.error('Erreur chargement clients :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des clients.'));
      }
    });
  }

  loadFournisseurs(): void {
    this.http.get<FournisseurItem[]>(this.fournisseursUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.fournisseurs = data || [];
        this.fournisseursLoaded = true;

        if (!this.form.fournisseurId && this.fournisseurs.length > 0) {
          this.form.fournisseurId = this.fournisseurs[0].id;
        }

        this.refreshView();
      },
      error: (err: any) => {
        console.error('Erreur chargement fournisseurs :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des fournisseurs.'));
      }
    });
  }

  loadEmplacements(): void {
    this.http.get<EmplacementItem[]>(this.emplacementsUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.emplacements = data || [];
        this.emplacementsLoaded = true;

        this.ensureFormEmplacementInContext();
        this.inferDesignationContextNameFromEmplacements();
        this.refreshView();
      },
      error: (err: any) => {
        console.error('Erreur chargement emplacements :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des emplacements.'));
      }
    });
  }

  setViewMode(mode: OutilViewMode): void {
    this.viewMode = mode;
    localStorage.setItem(this.viewModeStorageKey, mode);
    this.cdr.detectChanges();
  }

  toggleSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = field === 'dateCreation' ? 'desc' : 'asc';
    }

    this.saveSortPreferences();
    this.applyFilters();
  }

  applyFilters(): void {
    const search = this.normalizeText(this.searchText);

    const filtered = this.getBaseOutilsForCurrentContext().filter(item => {
      const ligneName = this.getLigneName(item);
      const clientName = this.getClientName(item);
      const fournisseurName = this.getFournisseurName(item);
      const matiereName = this.getMatiereName(item);
      const designationName = this.getDesignationName(item);
      const emplacementName = this.getEmplacementName(item);
      const status = this.normalizeStatus(item.status);
      const dateLabel = this.formatCreationDate(item);

      const matchesSearch =
        !search ||
        this.normalizeText(String(item.id)).includes(search) ||
        this.normalizeText(ligneName).includes(search) ||
        this.normalizeText(clientName).includes(search) ||
        this.normalizeText(fournisseurName).includes(search) ||
        this.normalizeText(matiereName).includes(search) ||
        this.normalizeText(designationName).includes(search) ||
        this.normalizeText(emplacementName).includes(search) ||
        this.normalizeText(item.ott).includes(search) ||
        this.normalizeText(item.codeOutillage).includes(search) ||
        this.normalizeText(status).includes(search) ||
        this.normalizeText(this.getStatusLabel(status)).includes(search) ||
        this.normalizeText(dateLabel).includes(search);

      const matchesLigne =
        !this.selectedLigne ||
        ligneName === this.selectedLigne;

      const matchesClient =
        !this.selectedClient ||
        clientName === this.selectedClient;

      const matchesFournisseur =
        !this.selectedFournisseur ||
        fournisseurName === this.selectedFournisseur;

      const matchesMatiere =
        !this.selectedMatiere ||
        matiereName === this.selectedMatiere;

      const matchesDesignation =
        !this.selectedDesignation ||
        designationName === this.selectedDesignation;

      const matchesStatus =
        !this.selectedStatus ||
        status === this.selectedStatus;

      return matchesSearch &&
        matchesLigne &&
        matchesClient &&
        matchesFournisseur &&
        matchesMatiere &&
        matchesDesignation &&
        matchesStatus;
    });

    this.filteredOutils = this.sortOutils(filtered);
    this.saveSortPreferences();
    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.searchText = '';
    this.selectedLigne = '';
    this.selectedClient = '';
    this.selectedFournisseur = '';
    this.selectedMatiere = '';
    this.selectedDesignation = '';
    this.selectedStatus = '';
    this.sortField = 'codeOutillage';
    this.sortDirection = 'asc';
    this.saveSortPreferences();
    this.applyFilters();
  }

  countByStatus(status: string): number {
    return this.getBaseOutilsForCurrentContext().filter(item => this.normalizeStatus(item.status) === status).length;
  }

  countStockRisks(): number {
    return this.getBaseOutilsForCurrentContext().filter(item => this.getStockState(item) !== 'NORMAL').length;
  }

  getTotalOutilsCount(): number {
    return this.getBaseOutilsForCurrentContext().length;
  }


  openCreateModal(): void {
    if (!this.canManageData()) {
      this.showError("Vous n'avez pas le droit d'ajouter des éléments.");
      return;
    }

    if (this.designationContextId && this.getContextEmplacements().length === 0) {
      this.showError("Aucun emplacement n'est lié à cette désignation. Créez d'abord un emplacement avec cette désignation.");
      return;
    }

    this.resetForm();
    this.isEditMode = false;
    this.showModal = true;
    this.cdr.detectChanges();
  }

  openEditModal(item: OutilItem): void {
    if (!this.canManageData()) {
      this.showError("Vous n'avez pas le droit de modifier des éléments.");
      return;
    }

    this.form = {
      id: item.id,
      ligneId: item.ligneId,
      clientId: item.clientId,
      fournisseurId: item.fournisseurId,
      emplacementId: item.emplacementId,
      ott: item.ott,
      codeOutillage: item.codeOutillage,
      status: this.normalizeStatus(item.status),
      valeur: item.valeur,
      justificationHS: item.justificationHS || '',
      dateAffectation: this.formatDateForInput(item.dateAffectation),
      createdAt: this.toDateInputValue(this.getCreationDateValue(item)),
      imageUrl: this.getOutilImageUrl(item),
      imagePreview: '',
      imageFile: null,
      removeImage: false
    };

    this.isEditMode = true;
    this.errorMessage = '';
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal(): void {
    this.showModal = false;
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  openImportModal(): void {
    if (!this.canManageData()) {
      this.showError("Vous n'avez pas le droit d'importer en masse.");
      return;
    }

    this.showImportModal = true;
    this.selectedImportFile = null;
    this.importErrorMessage = '';
    this.importSuccessMessage = '';
    this.cdr.detectChanges();
  }

  closeImportModal(): void {
    this.showImportModal = false;
    this.selectedImportFile = null;
    this.importErrorMessage = '';
    this.importSuccessMessage = '';
    this.cdr.detectChanges();
  }

  openReclamationModal(item: OutilItem): void {
    if (!this.canCreateReclamation()) {
      this.showError("Vous n'avez pas le droit de passer une réclamation.");
      return;
    }

    this.selectedReclamationOutil = item;
    this.reclamationErrorMessage = '';
    this.reclamationSuccessMessage = '';

    const stockState = this.getStockState(item);

    let title = `Réclamation outil ${item.codeOutillage}`;
    let problemType = this.normalizeStatus(item.status) === 'HS' ? 'Outil hors service' : 'Problème technique';
    let priority = this.normalizeStatus(item.status) === 'HS' ? 'HAUTE' : 'NORMALE';
    let description =
      `Réclamation concernant l’outil ${item.codeOutillage}. ` +
      `OTT : ${item.ott}. Ligne : ${this.getLigneName(item)}. Client : ${this.getClientName(item)}. ` +
      `Matière : ${this.getMatiereName(item)}. Désignation : ${this.getDesignationName(item)}.`;

    if (stockState === 'EPUISE') {
      title = `Outil épuisé : ${item.codeOutillage}`;
      problemType = 'Outil épuisé';
      priority = 'URGENTE';
      description =
        `L’outil ${item.codeOutillage} est épuisé. ` +
        `Valeur actuelle : ${item.valeur}. ` +
        `Merci de traiter cette réclamation rapidement.`;
    } else if (stockState === 'RISQUE') {
      title = `Risque d’épuisement : ${item.codeOutillage}`;
      problemType = 'Risque épuisement';
      priority = 'HAUTE';
      description =
        `L’outil ${item.codeOutillage} risque d’être épuisé bientôt. ` +
        `Valeur actuelle : ${item.valeur}. ` +
        `Merci de vérifier le stock ou prévoir une action.`;
    }

    this.reclamationForm = {
      title,
      problemType,
      description,
      reclamationDate: this.getTodayForInput(),
      priority
    };

    this.showReclamationModal = true;
    this.cdr.detectChanges();
  }

  closeReclamationModal(): void {
    this.showReclamationModal = false;
    this.selectedReclamationOutil = null;
    this.reclamationErrorMessage = '';
    this.reclamationSuccessMessage = '';
    this.cdr.detectChanges();
  }

  submitReclamation(): void {
    this.reclamationErrorMessage = '';
    this.reclamationSuccessMessage = '';

    if (!this.canCreateReclamation()) {
      this.reclamationErrorMessage = "Vous n'avez pas le droit de passer une réclamation.";
      this.cdr.detectChanges();
      return;
    }

    if (!this.selectedReclamationOutil) {
      this.reclamationErrorMessage = 'Aucun outil sélectionné.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.reclamationForm.title.trim()) {
      this.reclamationErrorMessage = 'Le titre de la réclamation est obligatoire.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.reclamationForm.problemType.trim()) {
      this.reclamationErrorMessage = 'Le type de problème est obligatoire.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.reclamationForm.description.trim()) {
      this.reclamationErrorMessage = 'La description du problème est obligatoire.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.reclamationForm.reclamationDate) {
      this.reclamationErrorMessage = 'La date de réclamation est obligatoire.';
      this.cdr.detectChanges();
      return;
    }

    const item = this.selectedReclamationOutil;

    const payload: CreateReclamationRequest = {
      title: this.reclamationForm.title.trim(),
      problemType: this.reclamationForm.problemType.trim(),
      description: this.reclamationForm.description.trim(),
      reclamationDate: this.reclamationForm.reclamationDate,
      sourcePage: 'Outils',
      entityName: 'Outil',
      entityId: item.id,
      entityLabel: this.getOutilReclamationLabel(item),
      priority: this.reclamationForm.priority
    };

    this.http.post(this.reclamationsUrl, payload, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.reclamationSuccessMessage = 'Réclamation envoyée avec succès.';
        this.showSuccess('Réclamation envoyée avec succès.');

        setTimeout(() => {
          this.closeReclamationModal();
        }, 900);

        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Erreur création réclamation outil :', err);
        this.reclamationErrorMessage = this.extractBackendError(
          err,
          'Erreur lors de l’envoi de la réclamation.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.showError('Veuillez sélectionner un fichier image valide.');
      return;
    }

    const maxSizeInMb = 5;
    const maxSizeInBytes = maxSizeInMb * 1024 * 1024;

    if (file.size > maxSizeInBytes) {
      this.showError(`La taille de l’image ne doit pas dépasser ${maxSizeInMb} Mo.`);
      return;
    }

    this.form.imageFile = file;
    this.form.removeImage = false;

    const reader = new FileReader();

    reader.onload = () => {
      this.form.imagePreview = String(reader.result || '');
      this.cdr.detectChanges();
    };

    reader.readAsDataURL(file);
  }

  removeSelectedImage(): void {
    this.form.imageFile = null;
    this.form.imagePreview = '';
    this.form.imageUrl = '';
    this.form.removeImage = true;
    this.cdr.detectChanges();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      this.selectedImportFile = input.files[0];
    } else {
      this.selectedImportFile = null;
    }

    this.importErrorMessage = '';
    this.importSuccessMessage = '';
    this.cdr.detectChanges();
  }

  submit(): void {
    if (!this.canManageData()) {
      this.showError("Vous n'avez pas le droit d'enregistrer des modifications.");
      return;
    }

    this.errorMessage = '';

    if (!this.form.ligneId) {
      this.showError('La ligne est obligatoire.');
      return;
    }

    if (!this.form.clientId) {
      this.showError('Le client est obligatoire.');
      return;
    }

    if (!this.form.fournisseurId) {
      this.showError('Le fournisseur est obligatoire.');
      return;
    }

    if (!this.form.emplacementId) {
      this.showError("L’emplacement est obligatoire.");
      return;
    }

    if (this.designationContextId && !this.getContextEmplacements().some(emplacement => emplacement.id === Number(this.form.emplacementId))) {
      this.showError("L’emplacement sélectionné ne correspond pas à la désignation ouverte.");
      return;
    }

    if (!this.form.ott.trim()) {
      this.showError("L’OTT est obligatoire.");
      return;
    }

    if (!this.form.codeOutillage.trim()) {
      this.showError('Le code outillage est obligatoire.');
      return;
    }

    if (!this.form.status.trim()) {
      this.showError('Le statut est obligatoire.');
      return;
    }

    const normalizedStatus = this.normalizeStatus(this.form.status);

    if (normalizedStatus === 'HS' && !this.form.justificationHS.trim()) {
      this.showError('La justification HS est obligatoire lorsque le statut est HS.');
      return;
    }

    const formData = this.buildOutilFormData(normalizedStatus);

    if (this.isEditMode) {
      this.http.put<void>(`${this.apiUrl}/${this.form.id}`, formData, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Outil modifié avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadOutils();
            this.resetForm();
          }, 100);
        },
        error: (err: any) => {
          console.error('Erreur modification outil :', err);
          this.showError(this.extractBackendError(err, 'Erreur lors de la modification.'));
        }
      });
    } else {
      this.http.post<OutilItem>(this.apiUrl, formData, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Outil ajouté avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadOutils();
            this.resetForm();
          }, 100);
        },
        error: (err: any) => {
          console.error('Erreur création outil :', err);
          this.showError(this.extractBackendError(err, 'Erreur lors de la création.'));
        }
      });
    }
  }

  deleteOutil(item: OutilItem): void {
    if (!this.canManageData()) {
      this.showError("Vous n'avez pas le droit de supprimer des éléments.");
      return;
    }

    const confirmed = confirm(`Supprimer l’outil "${item.codeOutillage}" ?`);

    if (!confirmed) {
      return;
    }

    this.http.delete<void>(`${this.apiUrl}/${item.id}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showSuccess('Outil supprimé avec succès.');

        setTimeout(() => {
          this.loadOutils();

          if (this.form.id === item.id) {
            this.resetForm();
          }
        }, 100);
      },
      error: (err: any) => {
        console.error('Erreur suppression outil :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors de la suppression.'));
      }
    });
  }

  resetForm(): void {
    this.form = {
      id: 0,
      ligneId: this.lignes.length > 0 ? this.lignes[0].id : 0,
      clientId: this.clients.length > 0 ? this.clients[0].id : 0,
      fournisseurId: this.fournisseurs.length > 0 ? this.fournisseurs[0].id : 0,
      emplacementId: this.getDefaultEmplacementId(),
      ott: '',
      codeOutillage: '',
      status: 'S',
      valeur: 0,
      justificationHS: '',
      dateAffectation: '',
      createdAt: this.getTodayForInput(),
      imageUrl: '',
      imagePreview: '',
      imageFile: null,
      removeImage: false
    };

    this.isEditMode = false;
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  private getBaseOutilsForCurrentContext(): OutilItem[] {
    if (!this.designationContextId) {
      return this.outils;
    }

    return this.outils.filter(item => this.getOutilDesignationId(item) === this.designationContextId);
  }

  private getOutilDesignationId(item: OutilItem): number | null {
    if (item.emplacement?.designationId) {
      return Number(item.emplacement.designationId);
    }

    if (item.emplacement?.designation?.id) {
      return Number(item.emplacement.designation.id);
    }

    const emplacement = this.emplacements.find(e => e.id === item.emplacementId);

    if (!emplacement) {
      return null;
    }

    return Number(emplacement.designationId || emplacement.designation?.id || 0) || null;
  }

  private getContextEmplacements(): EmplacementItem[] {
    if (!this.designationContextId) {
      return this.emplacements;
    }

    return this.emplacements.filter(emplacement =>
      Number(emplacement.designationId || emplacement.designation?.id || 0) === this.designationContextId
    );
  }

  private getDefaultEmplacementId(): number {
    const emplacement = this.getContextEmplacements()[0];
    return emplacement ? emplacement.id : 0;
  }

  private ensureFormEmplacementInContext(): void {
    const availableEmplacements = this.getContextEmplacements();

    if (availableEmplacements.length === 0) {
      this.form.emplacementId = 0;
      return;
    }

    const currentStillAvailable = availableEmplacements.some(
      emplacement => emplacement.id === Number(this.form.emplacementId)
    );

    if (!currentStillAvailable) {
      this.form.emplacementId = availableEmplacements[0].id;
    }
  }

  private inferDesignationContextNameFromEmplacements(): void {
    if (!this.designationContextId || this.designationContextName) {
      return;
    }

    const emplacement = this.emplacements.find(item =>
      Number(item.designationId || item.designation?.id || 0) === this.designationContextId
    );

    if (emplacement?.designation?.name) {
      this.designationContextName = emplacement.designation.name;
    }
  }

  getLigneName(item: OutilItem): string {
    if (item.ligne?.nom) {
      return item.ligne.nom;
    }

    const ligne = this.lignes.find(l => l.id === item.ligneId);
    return ligne ? ligne.nom : `ID ${item.ligneId}`;
  }

  getClientName(item: OutilItem): string {
    if (item.client?.nomClient) {
      return item.client.nomClient;
    }

    const client = this.clients.find(c => c.id === item.clientId);
    return client ? client.nomClient : `ID ${item.clientId}`;
  }

  getFournisseurName(item: OutilItem): string {
    if (item.fournisseur?.nomFournisseur) {
      return item.fournisseur.nomFournisseur;
    }

    const fournisseur = this.fournisseurs.find(f => f.id === item.fournisseurId);
    return fournisseur ? fournisseur.nomFournisseur : `ID ${item.fournisseurId}`;
  }

  getMatiereName(item: OutilItem): string {
    if (item.emplacement?.matiere?.nomMatiere) {
      return item.emplacement.matiere.nomMatiere;
    }

    const emplacement = this.emplacements.find(e => e.id === item.emplacementId);

    if (emplacement?.matiere?.nomMatiere) {
      return emplacement.matiere.nomMatiere;
    }

    return 'Non renseignée';
  }

  getDesignationName(item: OutilItem): string {
    if (item.emplacement?.designation?.name) {
      return item.emplacement.designation.name;
    }

    const emplacement = this.emplacements.find(e => e.id === item.emplacementId);

    if (emplacement?.designation?.name) {
      return emplacement.designation.name;
    }

    return 'Non renseignée';
  }

  getEmplacementName(item: OutilItem): string {
    if (item.emplacement) {
      return `${item.emplacement.armoire}-${item.emplacement.numero}`;
    }

    const emplacement = this.emplacements.find(e => e.id === item.emplacementId);
    return emplacement ? `${emplacement.armoire}-${emplacement.numero}` : `ID ${item.emplacementId}`;
  }

  getEmplacementLabel(emplacement: EmplacementItem): string {
    const matiere = emplacement.matiere?.nomMatiere || '';
    const designation = emplacement.designation?.name || '';
    const base = `${emplacement.armoire}-${emplacement.numero}`;

    if (matiere || designation) {
      return `${base} | ${matiere} | ${designation}`;
    }

    return base;
  }

  getOutilReclamationLabel(item: OutilItem): string {
    return `${item.codeOutillage} | OTT ${item.ott} | ${this.getLigneName(item)} | ${this.getEmplacementName(item)}`;
  }

  getOutilInitial(item: OutilItem): string {
    return item.codeOutillage?.trim()?.charAt(0)?.toUpperCase() || 'O';
  }

  getOutilImageUrl(item: OutilItem): string {
    const rawUrl =
      item.imageUrl ||
      item.photoUrl ||
      item.image ||
      item.emplacement?.designation?.imageUrl ||
      item.emplacement?.designation?.photoUrl ||
      item.emplacement?.designation?.image ||
      '';

    if (!rawUrl) {
      return '';
    }

    if (rawUrl.startsWith('http') || rawUrl.startsWith('data:')) {
      return rawUrl;
    }

    if (rawUrl.startsWith('/')) {
      return `${this.baseUrl}${rawUrl}`;
    }

    return rawUrl;
  }

  getStockState(item: OutilItem): 'EPUISE' | 'RISQUE' | 'NORMAL' {
    const valeur = Number(item.valeur) || 0;

    if (valeur <= 0) {
      return 'EPUISE';
    }

    if (valeur <= 5) {
      return 'RISQUE';
    }

    return 'NORMAL';
  }

  getStockLabel(item: OutilItem): string {
    const state = this.getStockState(item);

    if (state === 'EPUISE') {
      return 'Épuisé';
    }

    if (state === 'RISQUE') {
      return 'Risque épuisement';
    }

    return 'Stock normal';
  }

  getStatusLabel(status: string): string {
    const normalized = this.normalizeStatus(status);

    if (normalized === 'S') {
      return 'Service';
    }

    if (normalized === 'HS') {
      return 'HS';
    }

    return status || 'Non renseigné';
  }

  getSortLabel(field: SortField): string {
    if (field === 'codeOutillage') {
      return 'Code outillage';
    }

    if (field === 'ott') {
      return 'OTT';
    }

    return 'Date de création';
  }

  getCreationDateValue(item: OutilItem): string {
    return item.createdAt ||
      item.creationDate ||
      item.createdOn ||
      item.createdDate ||
      item.dateCreation ||
      item.dateAffectation ||
      '';
  }

  formatCreationDate(item: OutilItem): string {
    const rawDate = this.getCreationDateValue(item);

    if (!rawDate) {
      return 'Non renseignée';
    }

    const date = new Date(rawDate);

    if (Number.isNaN(date.getTime())) {
      return rawDate;
    }

    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  downloadTemplate(): void {
    const rows = [
      {
        ligne: '',
        client: '',
        fournisseur: '',
        emplacement: '',
        ott: '',
        codeOutillage: '',
        status: 'S',
        valeur: 0,
        justificationHS: '',
        dateAffectation: '',
        createdAt: ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 22 },
      { wch: 26 },
      { wch: 30 },
      { wch: 24 },
      { wch: 18 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 32 },
      { wch: 18 },
      { wch: 24 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'OutilsTemplate');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'modele_import_outils.xlsx');
  }

  downloadOutilsData(): void {
    const rows = this.filteredOutils.map(item => ({
      id: item.id,
      ligneId: item.ligneId,
      ligne: this.getLigneName(item),
      clientId: item.clientId,
      client: this.getClientName(item),
      fournisseurId: item.fournisseurId,
      fournisseur: this.getFournisseurName(item),
      emplacementId: item.emplacementId,
      emplacement: this.getEmplacementName(item),
      matiere: this.getMatiereName(item),
      designation: this.getDesignationName(item),
      ott: item.ott,
      codeOutillage: item.codeOutillage,
      status: this.getStatusLabel(item.status),
      valeur: item.valeur,
      stock: this.getStockLabel(item),
      justificationHS: item.justificationHS || '',
      dateAffectation: this.formatDateForInput(item.dateAffectation),
      dateCreation: this.formatCreationDate(item),
      updatedAt: item.updatedAt || '',
      imageUrl: this.getOutilImageUrl(item)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 12 },
      { wch: 22 },
      { wch: 12 },
      { wch: 26 },
      { wch: 14 },
      { wch: 30 },
      { wch: 16 },
      { wch: 24 },
      { wch: 24 },
      { wch: 28 },
      { wch: 18 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 24 },
      { wch: 32 },
      { wch: 18 },
      { wch: 24 },
      { wch: 48 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Outils');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'outils_export.xlsx');
  }

  importOutils(): void {
    if (!this.canManageData()) {
      this.showError("Vous n'avez pas le droit d'importer en masse.");
      return;
    }

    this.importErrorMessage = '';
    this.importSuccessMessage = '';

    if (!this.selectedImportFile) {
      this.importErrorMessage = 'Veuillez sélectionner un fichier Excel ou CSV.';
      this.cdr.detectChanges();
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const data = reader.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          this.importErrorMessage = 'Le fichier ne contient aucune feuille.';
          this.cdr.detectChanges();
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<any>(worksheet, { defval: '' });

        const outils = rows
          .map(row => {
            const ligneValue = String(
              row.ligneId ||
              row.LigneId ||
              row['Ligne ID'] ||
              row['ligne id'] ||
              row.ligne ||
              row.Ligne ||
              ''
            ).trim();

            const clientValue = String(
              row.clientId ||
              row.ClientId ||
              row['Client ID'] ||
              row['client id'] ||
              row.client ||
              row.Client ||
              row['Nom client'] ||
              row['nom client'] ||
              ''
            ).trim();

            const fournisseurValue = String(
              row.fournisseurId ||
              row.FournisseurId ||
              row['Fournisseur ID'] ||
              row['fournisseur id'] ||
              row.fournisseur ||
              row.Fournisseur ||
              row['Nom fournisseur'] ||
              row['nom fournisseur'] ||
              row['Code fournisseur'] ||
              row['code fournisseur'] ||
              ''
            ).trim();

            const emplacementValue = String(
              row.emplacementId ||
              row.EmplacementId ||
              row['Emplacement ID'] ||
              row['emplacement id'] ||
              row.emplacement ||
              row.Emplacement ||
              row.armoire ||
              row.Armoire ||
              ''
            ).trim();

            const ott = String(row.ott || row.OTT || '').trim();

            const codeOutillage = String(
              row.codeOutillage ||
              row.CodeOutillage ||
              row['Code outillage'] ||
              row['code outillage'] ||
              row.code ||
              row.Code ||
              ''
            ).trim();

            const status = this.normalizeStatus(
              String(
                row.status ||
                row.Status ||
                row.statut ||
                row.Statut ||
                'S'
              ).trim()
            );

            const valeur = Number(
              row.valeur ||
              row.Valeur ||
              row.value ||
              row.Value ||
              0
            ) || 0;

            const justificationHSRaw = String(
              row.justificationHS ||
              row.JustificationHS ||
              row['Justification HS'] ||
              row['justification hs'] ||
              row.justification ||
              row.Justification ||
              ''
            ).trim();

            const justificationHS = status === 'HS' ? justificationHSRaw : '';

            const dateAffectation = this.normalizeDateValue(
              row.dateAffectation ||
              row.DateAffectation ||
              row['Date affectation'] ||
              row['date affectation'] ||
              ''
            );

            const createdAt = this.normalizeDateValue(
              row.createdAt ||
              row.CreatedAt ||
              row.creationDate ||
              row.CreationDate ||
              row.createdOn ||
              row.CreatedOn ||
              row.createdDate ||
              row.CreatedDate ||
              row.dateCreation ||
              row.DateCreation ||
              row['Date de création'] ||
              row['date de création'] ||
              ''
            );

            const ligneId = this.resolveLigneId(ligneValue);
            const clientId = this.resolveClientId(clientValue);
            const fournisseurId = this.resolveFournisseurId(fournisseurValue);
            const emplacementId = this.resolveEmplacementId(emplacementValue);

            return {
              ligneId,
              clientId,
              fournisseurId,
              emplacementId,
              ott,
              codeOutillage,
              status,
              valeur,
              justificationHS,
              dateAffectation,
              createdAt
            };
          })
          .filter(outil =>
            outil.ligneId > 0 &&
            outil.clientId > 0 &&
            outil.fournisseurId > 0 &&
            outil.emplacementId > 0 &&
            outil.ott.length > 0 &&
            outil.codeOutillage.length > 0 &&
            outil.status.length > 0 &&
            (outil.status !== 'HS' || outil.justificationHS.length > 0)
          );

        if (outils.length === 0) {
          this.importErrorMessage =
            'Aucun outil valide trouvé. Vérifiez que les lignes, clients, fournisseurs et emplacements existent déjà dans l’application.';
          this.cdr.detectChanges();
          return;
        }

        this.createImportedOutils(outils);
      } catch (error) {
        console.error('Erreur lecture fichier import outils :', error);
        this.importErrorMessage = 'Erreur lors de la lecture du fichier.';
        this.cdr.detectChanges();
      }
    };

    reader.onerror = () => {
      this.importErrorMessage = 'Impossible de lire le fichier sélectionné.';
      this.cdr.detectChanges();
    };

    reader.readAsArrayBuffer(this.selectedImportFile);
  }

  normalizeStatus(value: string): string {
    const normalized = this.normalizeText(value);

    if (normalized === 's' || normalized === 'service' || normalized === 'en service') {
      return 'S';
    }

    if (normalized === 'hs' || normalized === 'hors service') {
      return 'HS';
    }

    return value || 'S';
  }

  formatDateForInput(value?: string): string {
    if (!value) {
      return '';
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString().slice(0, 10);
  }

  downloadOutilCard(item: OutilItem): void {
    if (!this.canDownloadOutilCard()) {
      this.showError("Vous n'avez pas le droit de télécharger la fiche PDF.");
      return;
    }

    this.http.get(`${this.apiUrl}/${item.id}/identity-card`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        saveAs(blob, `fiche_outil_${item.id}_${this.safeFileName(item.codeOutillage)}.pdf`);
      },
      error: (err: any) => {
        console.error('Erreur téléchargement fiche outil :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du téléchargement de la fiche PDF.'));
      }
    });
  }

  private buildOutilFormData(normalizedStatus: string): FormData {
    const formData = new FormData();

    formData.append('LigneId', String(Number(this.form.ligneId)));
    formData.append('ClientId', String(Number(this.form.clientId)));
    formData.append('FournisseurId', String(Number(this.form.fournisseurId)));
    formData.append('EmplacementId', String(Number(this.form.emplacementId)));
    formData.append('OTT', this.form.ott.trim());
    formData.append('CodeOutillage', this.form.codeOutillage.trim());
    formData.append('Status', normalizedStatus);
    formData.append('Valeur', String(Number(this.form.valeur) || 0));
    formData.append('JustificationHS', normalizedStatus === 'HS' ? this.form.justificationHS.trim() : '');
    formData.append('DateAffectation', this.form.dateAffectation || '');
    formData.append('CreatedAt', this.form.createdAt || this.getTodayForInput());
    formData.append('RemoveImage', String(this.form.removeImage));

    if (this.form.imageFile) {
      formData.append('Image', this.form.imageFile);
    }

    return formData;
  }

  private toDateInputValue(value: string): string {
    if (!value) {
      return this.getTodayForInput();
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 10);
    }

    return date.toISOString().slice(0, 10);
  }

  private safeFileName(value: string): string {
    return this.normalizeText(value)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'outil';
  }

  private refreshView(): void {
    this.rebuildFilterOptions();
    this.applyFilters();
  }

  private rebuildFilterOptions(): void {
    const lignes = new Set<string>();
    const clients = new Set<string>();
    const fournisseurs = new Set<string>();
    const matieres = new Set<string>();
    const designations = new Set<string>();

    this.getBaseOutilsForCurrentContext().forEach(item => {
      lignes.add(this.getLigneName(item));
      clients.add(this.getClientName(item));
      fournisseurs.add(this.getFournisseurName(item));
      matieres.add(this.getMatiereName(item));
      designations.add(this.getDesignationName(item));
    });

    this.ligneFilterOptions = this.toSortedOptions(lignes);
    this.clientFilterOptions = this.toSortedOptions(clients);
    this.fournisseurFilterOptions = this.toSortedOptions(fournisseurs);
    this.matiereFilterOptions = this.toSortedOptions(matieres);
    this.designationFilterOptions = this.toSortedOptions(designations);
  }

  private toSortedOptions(values: Set<string>): string[] {
    return Array.from(values)
      .filter(value => value && !value.startsWith('ID '))
      .sort((a, b) => a.localeCompare(b));
  }

  private sortOutils(items: OutilItem[]): OutilItem[] {
    return [...items].sort((a, b) => {
      let comparison = 0;

      if (this.sortField === 'codeOutillage') {
        comparison = this.normalizeText(a.codeOutillage).localeCompare(
          this.normalizeText(b.codeOutillage),
          'fr',
          { numeric: true, sensitivity: 'base' }
        );
      }

      if (this.sortField === 'ott') {
        comparison = this.normalizeText(a.ott).localeCompare(
          this.normalizeText(b.ott),
          'fr',
          { numeric: true, sensitivity: 'base' }
        );
      }

      if (this.sortField === 'dateCreation') {
        comparison = this.getSortableDateValue(a) - this.getSortableDateValue(b);
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  private getSortableDateValue(item: OutilItem): number {
    const rawDate = this.getCreationDateValue(item);

    if (!rawDate) {
      return 0;
    }

    const timestamp = new Date(rawDate).getTime();

    if (Number.isNaN(timestamp)) {
      return 0;
    }

    return timestamp;
  }

  private resolveLigneId(value: string): number {
    if (!value) {
      return 0;
    }

    const numericValue = Number(value);

    if (!Number.isNaN(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const normalizedValue = this.normalizeText(value);

    const ligne = this.lignes.find(item =>
      this.normalizeText(item.nom) === normalizedValue
    );

    return ligne ? ligne.id : 0;
  }

  private resolveClientId(value: string): number {
    if (!value) {
      return 0;
    }

    const numericValue = Number(value);

    if (!Number.isNaN(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const normalizedValue = this.normalizeText(value);

    const client = this.clients.find(item => {
      const label1 = item.nomClient;
      const label2 = item.nomFamille;
      const label3 = item.nomReference;
      const label4 = `${item.nomClient} ${item.nomFamille}`;
      const label5 = `${item.nomClient} ${item.nomReference}`;
      const label6 = `${item.nomClient}-${item.nomReference}`;

      return (
        this.normalizeText(label1) === normalizedValue ||
        this.normalizeText(label2) === normalizedValue ||
        this.normalizeText(label3) === normalizedValue ||
        this.normalizeText(label4) === normalizedValue ||
        this.normalizeText(label5) === normalizedValue ||
        this.normalizeText(label6) === normalizedValue
      );
    });

    return client ? client.id : 0;
  }

  private resolveFournisseurId(value: string): number {
    if (!value) {
      return 0;
    }

    const numericValue = Number(value);

    if (!Number.isNaN(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const normalizedValue = this.normalizeText(value);

    const fournisseur = this.fournisseurs.find(item => {
      const label1 = item.nomFournisseur;
      const label2 = item.codeFournisseur;
      const label3 = `${item.codeFournisseur} ${item.nomFournisseur}`;
      const label4 = `${item.codeFournisseur}-${item.nomFournisseur}`;

      return (
        this.normalizeText(label1) === normalizedValue ||
        this.normalizeText(label2) === normalizedValue ||
        this.normalizeText(label3) === normalizedValue ||
        this.normalizeText(label4) === normalizedValue
      );
    });

    return fournisseur ? fournisseur.id : 0;
  }

  private resolveEmplacementId(value: string): number {
    if (!value) {
      return 0;
    }

    const numericValue = Number(value);

    if (!Number.isNaN(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const normalizedValue = this.normalizeText(value);

    const emplacement = this.emplacements.find(item => {
      const label1 = `${item.armoire}-${item.numero}`;
      const label2 = `${item.armoire} ${item.numero}`;
      const label3 = `${item.armoire}${item.numero}`;
      const label4 = item.armoire;
      const label5 = item.numero;
      const label6 = item.matiere?.nomMatiere || '';
      const label7 = item.designation?.name || '';

      return (
        this.normalizeText(label1) === normalizedValue ||
        this.normalizeText(label2) === normalizedValue ||
        this.normalizeText(label3) === normalizedValue ||
        this.normalizeText(label4) === normalizedValue ||
        this.normalizeText(label5) === normalizedValue ||
        this.normalizeText(label6) === normalizedValue ||
        this.normalizeText(label7) === normalizedValue
      );
    });

    return emplacement ? emplacement.id : 0;
  }

  private createImportedOutils(outils: CreateOutilRequest[]): void {
    let successCount = 0;
    let errorCount = 0;
    let completed = 0;
    const backendErrors: string[] = [];

    outils.forEach((outil, index) => {
      const formData = new FormData();

      formData.append('LigneId', String(outil.ligneId));
      formData.append('ClientId', String(outil.clientId));
      formData.append('FournisseurId', String(outil.fournisseurId));
      formData.append('EmplacementId', String(outil.emplacementId));
      formData.append('OTT', outil.ott);
      formData.append('CodeOutillage', outil.codeOutillage);
      formData.append('Status', outil.status);
      formData.append('Valeur', String(outil.valeur || 0));
      formData.append('JustificationHS', outil.justificationHS || '');
      formData.append('DateAffectation', outil.dateAffectation || '');
      formData.append('CreatedAt', outil.createdAt || this.getTodayForInput());
      formData.append('RemoveImage', 'false');

      this.http.post<OutilItem>(this.apiUrl, formData, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          successCount++;
          completed++;
          this.finishImportIfDone(completed, outils.length, successCount, errorCount, backendErrors);
        },
        error: (err: any) => {
          console.error(`Erreur import outil ligne ${index + 1} :`, err, outil);

          const backendMessage = this.extractBackendError(
            err,
            `Erreur backend sur la ligne ${index + 1}.`
          );

          backendErrors.push(`Ligne ${index + 1} : ${backendMessage}`);

          errorCount++;
          completed++;
          this.finishImportIfDone(completed, outils.length, successCount, errorCount, backendErrors);
        }
      });
    });
  }

  private finishImportIfDone(
    completed: number,
    total: number,
    successCount: number,
    errorCount: number,
    backendErrors: string[]
  ): void {
    if (completed !== total) {
      return;
    }

    if (errorCount === 0) {
      this.importSuccessMessage = 'Import en masse effectué avec succès.';
      this.showSuccess(`${successCount} outil(s) importé(s) avec succès.`);

      setTimeout(() => {
        this.loadOutils();
        this.closeImportModal();
      }, 800);
    } else {
      const details = backendErrors.length > 0
        ? ` Détail : ${backendErrors[0]}`
        : '';

      this.importErrorMessage =
        `${successCount} importé(s), ${errorCount} erreur(s). Vérifiez les données ou les références.${details}`;

      this.loadOutils();
      this.cdr.detectChanges();
    }
  }

  private normalizeText(value: string | null | undefined): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private normalizeDateValue(value: any): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'number') {
      if (value < 1000) {
        return '';
      }

      const parsed = XLSX.SSF.parse_date_code(value);

      if (!parsed) {
        return '';
      }

      const month = String(parsed.m).padStart(2, '0');
      const day = String(parsed.d).padStart(2, '0');

      return `${parsed.y}-${month}-${day}`;
    }

    const text = String(value).trim();

    if (!text) {
      return '';
    }

    if (/^\d+$/.test(text) && Number(text) < 1000) {
      return '';
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }

    const date = new Date(text);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toISOString().slice(0, 10);
  }

  private restoreViewMode(): void {
    const saved = localStorage.getItem(this.viewModeStorageKey);

    if (saved === 'list' || saved === 'images') {
      this.viewMode = saved;
    }
  }

  private restoreSortPreferences(): void {
    const savedSortField = localStorage.getItem(this.sortFieldStorageKey);
    const savedSortDirection = localStorage.getItem(this.sortDirectionStorageKey);

    if (
      savedSortField === 'codeOutillage' ||
      savedSortField === 'ott' ||
      savedSortField === 'dateCreation'
    ) {
      this.sortField = savedSortField;
    }

    if (savedSortDirection === 'asc' || savedSortDirection === 'desc') {
      this.sortDirection = savedSortDirection;
    }
  }

  private saveSortPreferences(): void {
    localStorage.setItem(this.sortFieldStorageKey, this.sortField);
    localStorage.setItem(this.sortDirectionStorageKey, this.sortDirection);
  }

  private getTodayForInput(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
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

  private extractBackendError(err: any, fallback: string): string {
    if (!err) {
      return fallback;
    }

    const rawError =
      typeof err.error === 'string'
        ? err.error
        : JSON.stringify(err.error || '');

    if (
      rawError.includes('Microsoft.Data.SqlClient.SqlException') ||
      rawError.includes('Connection Timeout Expired') ||
      rawError.includes('The timeout period elapsed') ||
      rawError.includes('SQL Server')
    ) {
      return 'Erreur de connexion à la base de données. Vérifiez que SQL Server est lancé et que la chaîne de connexion backend est correcte.';
    }

    if (typeof err.error === 'string' && err.error.trim()) {
      return err.error;
    }

    if (err.error?.message) {
      return err.error.message;
    }

    if (err.error?.title) {
      return err.error.title;
    }

    if (err.error?.errors) {
      const errors = err.error.errors;
      const firstKey = Object.keys(errors)[0];

      if (firstKey && Array.isArray(errors[firstKey]) && errors[firstKey].length > 0) {
        return errors[firstKey][0];
      }
    }

    if (err.status === 0) {
      return 'Impossible de contacter le serveur backend. Vérifiez que l’API est lancée.';
    }

    if (err.status === 400) {
      return 'Données invalides. Vérifiez les champs saisis.';
    }

    if (err.status === 401) {
      return 'Session expirée ou utilisateur non authentifié.';
    }

    if (err.status === 403) {
      return "Action interdite : vous n'avez pas les droits nécessaires.";
    }

    if (err.status === 500) {
      return 'Erreur interne du serveur. Vérifiez la console backend.';
    }

    if (err.message) {
      return err.message;
    }

    return fallback;
  }

  private showSuccess(message: string): void {
    this.errorMessage = '';
    this.successMessage = message;

    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
    }

    this.cdr.detectChanges();

    this.successTimeout = setTimeout(() => {
      this.successMessage = '';
      this.cdr.detectChanges();
    }, 3000);
  }

  private showError(message: string): void {
    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
    }

    this.successMessage = '';
    this.errorMessage = message;
    this.cdr.detectChanges();
  }
}