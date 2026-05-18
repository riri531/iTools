import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { AuthService } from '../../../core/services/auth';

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

  imageUrl?: string | null;
  photoUrl?: string | null;
  image?: string | null;

  createdAt?: string | null;
  creationDate?: string | null;
  createdOn?: string | null;
  createdDate?: string | null;
  dateCreation?: string | null;
}

interface CreateEmplacementRequest {
  matiereId: number;
  armoire: string;
  numero: string;
  designationId: number;
  status: string;
}

interface UpdateEmplacementRequest {
  matiereId: number;
  armoire: string;
  numero: string;
  designationId: number;
  status: string;
}

interface ImportedEmplacementRow {
  matiereId: number;
  armoire: string;
  numero: string;
  designationId: number;
  status: string;
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

type EmplacementViewMode = 'list' | 'images';
type SortField = 'designation' | 'matiere' | 'armoire' | 'numero' | 'createdAt';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-emplacements',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  templateUrl: './emplacements.html',
  styleUrl: './emplacements.scss'
})
export class EmplacementsComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);

  private apiUrl = 'http://localhost:5160/api/Emplacements';
  private matieresUrl = 'http://localhost:5160/api/Matieres';
  private designationsUrl = 'http://localhost:5160/api/Designations';
  private reclamationsUrl = 'http://localhost:5160/api/Reclamations';
  private baseUrl = 'http://localhost:5160';

  private viewModeStorageKey = 'itools_emplacements_view_mode';
  private sortFieldStorageKey = 'itools_emplacements_sort_field';
  private sortDirectionStorageKey = 'itools_emplacements_sort_direction';

  emplacements: EmplacementItem[] = [];
  filteredEmplacements: EmplacementItem[] = [];
  matieres: MatiereItem[] = [];
  designations: DesignationItem[] = [];

  viewMode: EmplacementViewMode = 'list';
  searchText = '';
  selectedStatus = '';
  selectedMatiere = '';
  selectedDesignation = '';

  statusFilterOptions = ['Libre', 'S', 'HS'];
  matiereFilterOptions: string[] = [];
  designationFilterOptions: string[] = [];

  sortField: SortField = 'designation';
  sortDirection: SortDirection = 'asc';

  showModal = false;
  showImportModal = false;
  showReclamationModal = false;

  selectedImportFile: File | null = null;
  importErrorMessage = '';
  importSuccessMessage = '';

  selectedReclamationEmplacement: EmplacementItem | null = null;
  reclamationErrorMessage = '';
  reclamationSuccessMessage = '';

  reclamationProblemTypes = [
    'Emplacement indisponible',
    'Emplacement hors service',
    'Erreur de données',
    'Mauvaise affectation',
    'Problème matière',
    'Problème désignation',
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
    problemType: 'Emplacement indisponible',
    description: '',
    reclamationDate: '',
    priority: 'NORMALE'
  };

  statusOptions = ['Libre', 'S', 'HS'];

  form = {
    id: 0,
    matiereId: 0,
    armoire: '',
    numero: '',
    designationId: 0,
    status: 'Libre'
  };

  isEditMode = false;
  successMessage = '';
  errorMessage = '';

  private successTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.restoreViewMode();
    this.restoreSortPreferences();
    this.loadMatieres();
    this.loadDesignations();
    this.loadEmplacements();
  }

  canCreateReclamation(): boolean {
    const role = this.authService.getRole();
    return role === 'EMPLOYE' || role === 'RESPONSABLE';
  }

  loadEmplacements(): void {
    this.http.get<EmplacementItem[]>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.emplacements = data || [];
        this.rebuildFilterOptions();
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error(err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des emplacements.'));
      }
    });
  }

  loadMatieres(): void {
    this.http.get<MatiereItem[]>(this.matieresUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.matieres = data || [];

        if (!this.form.matiereId && this.matieres.length > 0) {
          this.form.matiereId = this.matieres[0].id;
        }

        this.rebuildFilterOptions();
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error(err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des matières.'));
      }
    });
  }

  loadDesignations(): void {
    this.http.get<DesignationItem[]>(this.designationsUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.designations = data || [];

        if (!this.form.designationId && this.designations.length > 0) {
          this.form.designationId = this.designations[0].id;
        }

        this.rebuildFilterOptions();
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error(err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des désignations.'));
      }
    });
  }

  setViewMode(mode: EmplacementViewMode): void {
    this.viewMode = mode;
    localStorage.setItem(this.viewModeStorageKey, mode);
    this.cdr.detectChanges();
  }

  toggleSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    this.saveSortPreferences();
    this.applyFilters();
  }

  applyFilters(): void {
    const search = this.normalizeText(this.searchText);

    const filtered = this.emplacements.filter(item => {
      const matiereName = this.getMatiereName(item);
      const designationName = this.getDesignationName(item);
      const status = this.normalizeStatus(item.status);
      const dateLabel = this.formatCreationDate(item);

      const matchesSearch =
        !search ||
        this.normalizeText(matiereName).includes(search) ||
        this.normalizeText(item.armoire).includes(search) ||
        this.normalizeText(item.numero).includes(search) ||
        this.normalizeText(designationName).includes(search) ||
        this.normalizeText(status).includes(search) ||
        this.normalizeText(this.getStatusLabel(status)).includes(search) ||
        this.normalizeText(dateLabel).includes(search);

      const matchesStatus =
        !this.selectedStatus ||
        status === this.selectedStatus;

      const matchesMatiere =
        !this.selectedMatiere ||
        matiereName === this.selectedMatiere;

      const matchesDesignation =
        !this.selectedDesignation ||
        designationName === this.selectedDesignation;

      return matchesSearch && matchesStatus && matchesMatiere && matchesDesignation;
    });

    this.filteredEmplacements = this.sortEmplacements(filtered);
    this.saveSortPreferences();
    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.searchText = '';
    this.selectedStatus = '';
    this.selectedMatiere = '';
    this.selectedDesignation = '';
    this.sortField = 'designation';
    this.sortDirection = 'asc';
    this.saveSortPreferences();
    this.applyFilters();
  }

  countByStatus(status: string): number {
    return this.emplacements.filter(item => this.normalizeStatus(item.status) === status).length;
  }

  openCreateModal(): void {
    this.resetForm();
    this.isEditMode = false;
    this.showModal = true;
    this.cdr.detectChanges();
  }

  openEditModal(item: EmplacementItem): void {
    this.form = {
      id: item.id,
      matiereId: item.matiereId,
      armoire: item.armoire,
      numero: item.numero,
      designationId: item.designationId,
      status: this.normalizeStatus(item.status)
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

  openReclamationModal(item: EmplacementItem): void {
    if (!this.canCreateReclamation()) {
      this.showError("Vous n'avez pas le droit de passer une réclamation.");
      return;
    }

    this.selectedReclamationEmplacement = item;
    this.reclamationErrorMessage = '';
    this.reclamationSuccessMessage = '';

    let title = `Réclamation emplacement ${item.armoire}-${item.numero}`;
    let problemType = 'Emplacement indisponible';
    let priority = 'NORMALE';
    let description =
      `Réclamation concernant l’emplacement ${item.armoire}-${item.numero}. ` +
      `Matière : ${this.getMatiereName(item)}. ` +
      `Désignation : ${this.getDesignationName(item)}. ` +
      `Statut : ${this.getStatusLabel(item.status)}.`;

    if (this.normalizeStatus(item.status) === 'HS') {
      title = `Emplacement hors service : ${item.armoire}-${item.numero}`;
      problemType = 'Emplacement hors service';
      priority = 'HAUTE';
      description =
        `L’emplacement ${item.armoire}-${item.numero} est marqué hors service. ` +
        `Matière : ${this.getMatiereName(item)}. ` +
        `Désignation : ${this.getDesignationName(item)}. ` +
        `Merci de vérifier et traiter cette réclamation.`;
    } else if (this.normalizeStatus(item.status) === 'S') {
      title = `Emplacement occupé / à vérifier : ${item.armoire}-${item.numero}`;
      problemType = 'Mauvaise affectation';
      priority = 'NORMALE';
      description =
        `L’emplacement ${item.armoire}-${item.numero} est actuellement occupé. ` +
        `Merci de vérifier si l’affectation est correcte.`;
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
    this.selectedReclamationEmplacement = null;
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

    if (!this.selectedReclamationEmplacement) {
      this.reclamationErrorMessage = 'Aucun emplacement sélectionné.';
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

    const item = this.selectedReclamationEmplacement;

    const payload: CreateReclamationRequest = {
      title: this.reclamationForm.title.trim(),
      problemType: this.reclamationForm.problemType.trim(),
      description: this.reclamationForm.description.trim(),
      reclamationDate: this.reclamationForm.reclamationDate,
      sourcePage: 'Emplacements',
      entityName: 'Emplacement',
      entityId: item.id,
      entityLabel: this.getEmplacementReclamationLabel(item),
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
        console.error('Erreur création réclamation emplacement :', err);
        this.reclamationErrorMessage = this.extractBackendError(
          err,
          'Erreur lors de l’envoi de la réclamation.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      this.selectedImportFile = input.files[0];
    } else {
      this.selectedImportFile = null;
    }

    this.cdr.detectChanges();
  }

  submit(): void {
    this.errorMessage = '';

    if (!this.form.matiereId) {
      this.showError('La matière est obligatoire.');
      return;
    }

    if (!this.form.armoire.trim()) {
      this.showError("L’armoire est obligatoire.");
      return;
    }

    if (!this.form.numero.trim()) {
      this.showError('Le numéro est obligatoire.');
      return;
    }

    if (!this.form.designationId) {
      this.showError('La désignation est obligatoire.');
      return;
    }

    if (!this.form.status.trim()) {
      this.showError('Le statut est obligatoire.');
      return;
    }

    const payload: CreateEmplacementRequest | UpdateEmplacementRequest = {
      matiereId: Number(this.form.matiereId),
      armoire: this.form.armoire.trim(),
      numero: this.form.numero.trim(),
      designationId: Number(this.form.designationId),
      status: this.normalizeStatus(this.form.status.trim())
    };

    if (this.isEditMode) {
      this.http.put<void>(`${this.apiUrl}/${this.form.id}`, payload, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Emplacement modifié avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadEmplacements();
            this.resetForm();
          }, 100);
        },
        error: (err: any) => {
          console.error(err);
          this.showError(this.extractBackendError(err, 'Erreur lors de la modification.'));
        }
      });
    } else {
      this.http.post<EmplacementItem>(this.apiUrl, payload, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Emplacement ajouté avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadEmplacements();
            this.resetForm();
          }, 100);
        },
        error: (err: any) => {
          console.error(err);
          this.showError(this.extractBackendError(err, 'Erreur lors de la création.'));
        }
      });
    }
  }

  deleteEmplacement(item: EmplacementItem): void {
    const confirmed = confirm(`Supprimer l’emplacement "${item.armoire}-${item.numero}" ?`);

    if (!confirmed) {
      return;
    }

    this.http.delete<void>(`${this.apiUrl}/${item.id}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showSuccess('Emplacement supprimé avec succès.');

        setTimeout(() => {
          this.loadEmplacements();

          if (this.form.id === item.id) {
            this.resetForm();
          }
        }, 100);
      },
      error: (err: any) => {
        console.error(err);
        this.showError(this.extractBackendError(err, 'Erreur lors de la suppression.'));
      }
    });
  }

  resetForm(): void {
    this.form = {
      id: 0,
      matiereId: this.matieres.length > 0 ? this.matieres[0].id : 0,
      armoire: '',
      numero: '',
      designationId: this.designations.length > 0 ? this.designations[0].id : 0,
      status: 'Libre'
    };

    this.isEditMode = false;
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  getMatiereName(item: EmplacementItem): string {
    if (item.matiere?.nomMatiere) {
      return item.matiere.nomMatiere;
    }

    const matiere = this.matieres.find(m => m.id === item.matiereId);
    return matiere ? matiere.nomMatiere : `ID ${item.matiereId}`;
  }

  getDesignationName(item: EmplacementItem): string {
    if (item.designation?.name) {
      return item.designation.name;
    }

    const designation = this.designations.find(d => d.id === item.designationId);
    return designation ? designation.name : `ID ${item.designationId}`;
  }

  getEmplacementReclamationLabel(item: EmplacementItem): string {
    return `${item.armoire}-${item.numero} | ${this.getMatiereName(item)} | ${this.getDesignationName(item)} | ${this.getStatusLabel(item.status)}`;
  }

  getEmplacementInitial(item: EmplacementItem): string {
    const designation = this.getDesignationName(item);

    if (designation && !designation.startsWith('ID ')) {
      return designation.charAt(0).toUpperCase();
    }

    return item.armoire?.charAt(0)?.toUpperCase() || 'E';
  }

  getEmplacementImageUrl(item: EmplacementItem): string {
    const rawUrl =
      item.imageUrl ||
      item.photoUrl ||
      item.image ||
      item.designation?.imageUrl ||
      item.designation?.photoUrl ||
      item.designation?.image ||
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

  getStatusLabel(status: string): string {
    const normalized = this.normalizeStatus(status);

    if (normalized === 'Libre') {
      return 'Libre';
    }

    if (normalized === 'S') {
      return 'Occupé';
    }

    if (normalized === 'HS') {
      return 'HS';
    }

    return status || 'Non renseigné';
  }

  getSortLabel(field: SortField): string {
    if (field === 'designation') {
      return 'Désignation';
    }

    if (field === 'matiere') {
      return 'Matière';
    }

    if (field === 'armoire') {
      return 'Armoire';
    }

    if (field === 'numero') {
      return 'Numéro';
    }

    return 'Date de création';
  }

  getCreationDateValue(item: EmplacementItem): string {
    return item.createdAt ||
      item.creationDate ||
      item.createdOn ||
      item.createdDate ||
      item.dateCreation ||
      '';
  }

  formatCreationDate(item: EmplacementItem): string {
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
        matiere: '',
        armoire: '',
        numero: '',
        designation: '',
        status: 'Libre',
        imageUrl: '',
        createdAt: ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 34 },
      { wch: 16 },
      { wch: 48 },
      { wch: 24 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'EmplacementsTemplate');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'modele_import_emplacements.xlsx');
  }

  downloadEmplacementsData(): void {
    const rows = this.filteredEmplacements.map(item => ({
      id: item.id,
      matiereId: item.matiereId,
      matiere: this.getMatiereName(item),
      armoire: item.armoire,
      numero: item.numero,
      designationId: item.designationId,
      designation: this.getDesignationName(item),
      status: this.getStatusLabel(item.status),
      createdAt: this.formatCreationDate(item),
      imageUrl: this.getEmplacementImageUrl(item)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 14 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 34 },
      { wch: 16 },
      { wch: 24 },
      { wch: 48 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Emplacements');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'emplacements_export.xlsx');
  }

  importEmplacements(): void {
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

        const emplacements: ImportedEmplacementRow[] = rows
          .map(row => {
            const matiereValue = String(
              row.matiereId ||
              row.MatiereId ||
              row['Matiere ID'] ||
              row['Matière ID'] ||
              row['matiere id'] ||
              row['matière id'] ||
              row.matiere ||
              row.Matiere ||
              row.matière ||
              row.Matière ||
              row['Nom matière'] ||
              row['nom matière'] ||
              row['Nom matiere'] ||
              row['nom matiere'] ||
              ''
            ).trim();

            const designationValue = String(
              row.designationId ||
              row.DesignationId ||
              row['Designation ID'] ||
              row['Désignation ID'] ||
              row['designation id'] ||
              row['désignation id'] ||
              row.designation ||
              row.Designation ||
              row.désignation ||
              row.Désignation ||
              row['Nom désignation'] ||
              row['nom désignation'] ||
              row['Nom designation'] ||
              row['nom designation'] ||
              ''
            ).trim();

            const armoire = String(
              row.armoire ||
              row.Armoire ||
              ''
            ).trim();

            const numero = String(
              row.numero ||
              row.Numero ||
              row.numéro ||
              row.Numéro ||
              row.number ||
              row.Number ||
              ''
            ).trim();

            const status = this.normalizeStatus(
              String(
                row.status ||
                row.Status ||
                row.statut ||
                row.Statut ||
                'Libre'
              ).trim()
            );

            const matiereId = this.resolveMatiereId(matiereValue);
            const designationId = this.resolveDesignationId(designationValue);

            return {
              matiereId,
              armoire,
              numero,
              designationId,
              status
            };
          })
          .filter(emplacement =>
            emplacement.matiereId > 0 &&
            emplacement.armoire.length > 0 &&
            emplacement.numero.length > 0 &&
            emplacement.designationId > 0 &&
            emplacement.status.length > 0
          );

        if (emplacements.length === 0) {
          this.importErrorMessage =
            'Aucun emplacement valide trouvé. Vérifiez que les matières et les désignations existent déjà dans l’application.';
          this.cdr.detectChanges();
          return;
        }

        this.createImportedEmplacements(emplacements);
      } catch (error) {
        console.error(error);
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

    if (normalized === 'libre') {
      return 'Libre';
    }

    if (
      normalized === 's' ||
      normalized === 'service' ||
      normalized === 'en service' ||
      normalized === 'occupe' ||
      normalized === 'occupé'
    ) {
      return 'S';
    }

    if (normalized === 'hs' || normalized === 'hors service') {
      return 'HS';
    }

    return value || 'Libre';
  }

  private sortEmplacements(items: EmplacementItem[]): EmplacementItem[] {
    return [...items].sort((a, b) => {
      let comparison = 0;

      if (this.sortField === 'designation') {
        comparison = this.normalizeText(this.getDesignationName(a)).localeCompare(
          this.normalizeText(this.getDesignationName(b)),
          'fr',
          { numeric: true, sensitivity: 'base' }
        );
      }

      if (this.sortField === 'matiere') {
        comparison = this.normalizeText(this.getMatiereName(a)).localeCompare(
          this.normalizeText(this.getMatiereName(b)),
          'fr',
          { numeric: true, sensitivity: 'base' }
        );
      }

      if (this.sortField === 'armoire') {
        comparison = this.normalizeText(a.armoire).localeCompare(
          this.normalizeText(b.armoire),
          'fr',
          { numeric: true, sensitivity: 'base' }
        );
      }

      if (this.sortField === 'numero') {
        comparison = this.normalizeText(a.numero).localeCompare(
          this.normalizeText(b.numero),
          'fr',
          { numeric: true, sensitivity: 'base' }
        );
      }

      if (this.sortField === 'createdAt') {
        comparison = this.getSortableDateValue(a) - this.getSortableDateValue(b);
      }

      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
  }

  private getSortableDateValue(item: EmplacementItem): number {
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

  private rebuildFilterOptions(): void {
    const matieres = new Set<string>();
    const designations = new Set<string>();

    this.emplacements.forEach(item => {
      matieres.add(this.getMatiereName(item));
      designations.add(this.getDesignationName(item));
    });

    this.matiereFilterOptions = Array.from(matieres)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    this.designationFilterOptions = Array.from(designations)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  private resolveMatiereId(value: string): number {
    if (!value) {
      return 0;
    }

    const numericValue = Number(value);

    if (!Number.isNaN(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const normalizedValue = this.normalizeText(value);

    const matiere = this.matieres.find(item =>
      this.normalizeText(item.nomMatiere) === normalizedValue
    );

    return matiere ? matiere.id : 0;
  }

  private resolveDesignationId(value: string): number {
    if (!value) {
      return 0;
    }

    const numericValue = Number(value);

    if (!Number.isNaN(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const normalizedValue = this.normalizeText(value);

    const designation = this.designations.find(item =>
      this.normalizeText(item.name) === normalizedValue
    );

    return designation ? designation.id : 0;
  }

  private createImportedEmplacements(emplacements: CreateEmplacementRequest[]): void {
    let successCount = 0;
    let errorCount = 0;
    let completed = 0;

    emplacements.forEach((emplacement) => {
      this.http.post<EmplacementItem>(this.apiUrl, emplacement, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          successCount++;
          completed++;
          this.finishImportIfDone(completed, emplacements.length, successCount, errorCount);
        },
        error: () => {
          errorCount++;
          completed++;
          this.finishImportIfDone(completed, emplacements.length, successCount, errorCount);
        }
      });
    });
  }

  private finishImportIfDone(
    completed: number,
    total: number,
    successCount: number,
    errorCount: number
  ): void {
    if (completed !== total) {
      return;
    }

    if (errorCount === 0) {
      this.importSuccessMessage = 'Import en masse effectué avec succès.';
      this.showSuccess(`${successCount} emplacement(s) importé(s) avec succès.`);

      setTimeout(() => {
        this.loadEmplacements();
        this.closeImportModal();
      }, 800);
    } else {
      this.importErrorMessage =
        `${successCount} importé(s), ${errorCount} erreur(s). Vérifiez les données, les matières ou les désignations.`;
      this.cdr.detectChanges();
    }
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
      savedSortField === 'designation' ||
      savedSortField === 'matiere' ||
      savedSortField === 'armoire' ||
      savedSortField === 'numero' ||
      savedSortField === 'createdAt'
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

  private normalizeText(value: string | null | undefined): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
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