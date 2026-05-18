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

  imageUrl?: string | null;
  photoUrl?: string | null;
  image?: string | null;

  createdAt?: string | null;
  creationDate?: string | null;
  createdOn?: string | null;
  createdDate?: string | null;
  dateCreation?: string | null;
}

interface CreateMatiereRequest {
  nomMatiere: string;
  process: string;
}

interface UpdateMatiereRequest {
  nomMatiere: string;
  process: string;
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

type MatiereViewMode = 'list' | 'images';
type SortField = 'nomMatiere' | 'createdAt';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-matieres',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  templateUrl: './matieres.html',
  styleUrl: './matieres.scss'
})
export class MatieresComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);

  private apiUrl = 'http://localhost:5160/api/Matieres';
  private reclamationsUrl = 'http://localhost:5160/api/Reclamations';
  private baseUrl = 'http://localhost:5160';

  private viewModeStorageKey = 'itools_matieres_view_mode';
  private sortFieldStorageKey = 'itools_matieres_sort_field';
  private sortDirectionStorageKey = 'itools_matieres_sort_direction';

  matieres: MatiereItem[] = [];
  filteredMatieres: MatiereItem[] = [];

  viewMode: MatiereViewMode = 'list';
  searchText = '';
  selectedProcess = '';
  processOptions: string[] = [];

  sortField: SortField = 'nomMatiere';
  sortDirection: SortDirection = 'asc';

  showModal = false;
  showImportModal = false;
  showReclamationModal = false;

  selectedImportFile: File | null = null;
  importErrorMessage = '';
  importSuccessMessage = '';

  selectedReclamationMatiere: MatiereItem | null = null;
  reclamationErrorMessage = '';
  reclamationSuccessMessage = '';

  reclamationProblemTypes = [
    'Erreur de données',
    'Matière incorrecte',
    'Process incorrect',
    'Matière manquante',
    'Doublon',
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
    problemType: 'Erreur de données',
    description: '',
    reclamationDate: '',
    priority: 'NORMALE'
  };

  form = {
    id: 0,
    nomMatiere: '',
    process: ''
  };

  isEditMode = false;
  successMessage = '';
  errorMessage = '';

  private successTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.restoreViewMode();
    this.restoreSortPreferences();
    this.loadMatieres();
  }

  canCreateReclamation(): boolean {
    const role = this.authService.getRole();
    return role === 'EMPLOYE' || role === 'RESPONSABLE';
  }

  loadMatieres(): void {
    this.http.get<MatiereItem[]>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.matieres = data || [];
        this.rebuildProcessOptions();
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Erreur chargement matières :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des matières.'));
      }
    });
  }

  setViewMode(mode: MatiereViewMode): void {
    this.viewMode = mode;
    localStorage.setItem(this.viewModeStorageKey, mode);
    this.cdr.detectChanges();
  }

  toggleSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = field === 'nomMatiere' ? 'asc' : 'desc';
    }

    this.saveSortPreferences();
    this.applyFilters();
  }

  applyFilters(): void {
    const search = this.normalizeText(this.searchText);

    const filtered = this.matieres.filter(item => {
      const process = item.process || '';
      const creationDateLabel = this.formatCreationDate(item);

      const matchesSearch =
        !search ||
        this.normalizeText(String(item.id)).includes(search) ||
        this.normalizeText(item.nomMatiere).includes(search) ||
        this.normalizeText(process).includes(search) ||
        this.normalizeText(creationDateLabel).includes(search);

      const matchesProcess =
        !this.selectedProcess ||
        process === this.selectedProcess;

      return matchesSearch && matchesProcess;
    });

    this.filteredMatieres = this.sortMatieres(filtered);
    this.saveSortPreferences();
    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.searchText = '';
    this.selectedProcess = '';
    this.sortField = 'nomMatiere';
    this.sortDirection = 'asc';
    this.saveSortPreferences();
    this.applyFilters();
  }

  openCreateModal(): void {
    this.resetForm();
    this.isEditMode = false;
    this.showModal = true;
    this.cdr.detectChanges();
  }

  openEditModal(item: MatiereItem): void {
    this.form = {
      id: item.id,
      nomMatiere: item.nomMatiere,
      process: item.process
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

  submit(): void {
    this.errorMessage = '';

    if (!this.form.nomMatiere.trim()) {
      this.showError('Le nom de la matière est obligatoire.');
      return;
    }

    if (!this.form.process.trim()) {
      this.showError('Le process est obligatoire.');
      return;
    }

    const payload: CreateMatiereRequest | UpdateMatiereRequest = {
      nomMatiere: this.form.nomMatiere.trim(),
      process: this.form.process.trim()
    };

    if (this.isEditMode) {
      this.http.put<void>(`${this.apiUrl}/${this.form.id}`, payload, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Matière modifiée avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadMatieres();
            this.resetForm();
          }, 100);
        },
        error: (err: any) => {
          console.error('Erreur modification matière :', err);
          this.showError(this.extractBackendError(err, 'Erreur lors de la modification.'));
        }
      });
    } else {
      this.http.post<MatiereItem>(this.apiUrl, payload, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Matière ajoutée avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadMatieres();
            this.resetForm();
          }, 100);
        },
        error: (err: any) => {
          console.error('Erreur création matière :', err);
          this.showError(this.extractBackendError(err, 'Erreur lors de la création.'));
        }
      });
    }
  }

  deleteMatiere(item: MatiereItem): void {
    const confirmed = confirm(`Supprimer la matière "${item.nomMatiere}" ?`);

    if (!confirmed) {
      return;
    }

    this.http.delete<void>(`${this.apiUrl}/${item.id}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showSuccess('Matière supprimée avec succès.');

        setTimeout(() => {
          this.loadMatieres();

          if (this.form.id === item.id) {
            this.resetForm();
          }
        }, 100);
      },
      error: (err: any) => {
        console.error('Erreur suppression matière :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors de la suppression.'));
      }
    });
  }

  resetForm(): void {
    this.form = {
      id: 0,
      nomMatiere: '',
      process: ''
    };

    this.isEditMode = false;
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

  importMatieres(): void {
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

        const matieres = rows
          .map(row => {
            const nomMatiere = String(
              row.nomMatiere ||
              row.NomMatiere ||
              row['Nom matière'] ||
              row['nom matière'] ||
              row['Nom matiere'] ||
              row['nom matiere'] ||
              row.matiere ||
              row.Matiere ||
              row.matière ||
              row.Matière ||
              ''
            ).trim();

            const process = String(
              row.process ||
              row.Process ||
              row.processus ||
              row.Processus ||
              ''
            ).trim();

            return {
              nomMatiere,
              process
            };
          })
          .filter(item =>
            item.nomMatiere.length > 0 &&
            item.process.length > 0
          );

        if (matieres.length === 0) {
          this.importErrorMessage = 'Aucune matière valide trouvée dans le fichier.';
          this.cdr.detectChanges();
          return;
        }

        this.createImportedMatieres(matieres);
      } catch (error) {
        console.error('Erreur lecture fichier import matières :', error);
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

  private createImportedMatieres(matieres: CreateMatiereRequest[]): void {
    let successCount = 0;
    let errorCount = 0;
    let completed = 0;
    const backendErrors: string[] = [];

    matieres.forEach((matiere, index) => {
      this.http.post<MatiereItem>(this.apiUrl, matiere, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          successCount++;
          completed++;
          this.finishImportIfDone(completed, matieres.length, successCount, errorCount, backendErrors);
        },
        error: (err: any) => {
          const backendMessage = this.extractBackendError(
            err,
            `Erreur backend sur la ligne ${index + 1}.`
          );

          backendErrors.push(`Ligne ${index + 1} : ${backendMessage}`);

          errorCount++;
          completed++;
          this.finishImportIfDone(completed, matieres.length, successCount, errorCount, backendErrors);
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
      this.showSuccess(`${successCount} matière(s) importée(s) avec succès.`);

      setTimeout(() => {
        this.loadMatieres();
        this.closeImportModal();
      }, 800);
    } else {
      const details = backendErrors.length > 0
        ? ` Détail : ${backendErrors[0]}`
        : '';

      this.importErrorMessage =
        `${successCount} importée(s), ${errorCount} erreur(s). Vérifiez les données.${details}`;

      this.loadMatieres();
      this.cdr.detectChanges();
    }
  }

  downloadTemplate(): void {
    const rows = [
      {
        nomMatiere: '',
        process: '',
        imageUrl: '',
        createdAt: ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 30 },
      { wch: 24 },
      { wch: 48 },
      { wch: 24 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MatieresTemplate');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'modele_import_matieres.xlsx');
  }

  downloadMatieresData(): void {
    const rows = this.filteredMatieres.map(item => ({
      id: item.id,
      nomMatiere: item.nomMatiere,
      process: item.process,
      createdAt: this.formatCreationDate(item),
      imageUrl: this.getMatiereImageUrl(item)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 30 },
      { wch: 24 },
      { wch: 24 },
      { wch: 48 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Matieres');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'matieres_export.xlsx');
  }

  openReclamationModal(item: MatiereItem): void {
    if (!this.canCreateReclamation()) {
      this.showError("Vous n'avez pas le droit de passer une réclamation.");
      return;
    }

    this.selectedReclamationMatiere = item;
    this.reclamationErrorMessage = '';
    this.reclamationSuccessMessage = '';

    this.reclamationForm = {
      title: `Réclamation matière : ${item.nomMatiere}`,
      problemType: 'Erreur de données',
      description:
        `Réclamation concernant la matière ${item.nomMatiere}. ` +
        `Process : ${item.process}.`,
      reclamationDate: this.getTodayForInput(),
      priority: 'NORMALE'
    };

    this.showReclamationModal = true;
    this.cdr.detectChanges();
  }

  closeReclamationModal(): void {
    this.showReclamationModal = false;
    this.selectedReclamationMatiere = null;
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

    if (!this.selectedReclamationMatiere) {
      this.reclamationErrorMessage = 'Aucune matière sélectionnée.';
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

    const item = this.selectedReclamationMatiere;

    const payload: CreateReclamationRequest = {
      title: this.reclamationForm.title.trim(),
      problemType: this.reclamationForm.problemType.trim(),
      description: this.reclamationForm.description.trim(),
      reclamationDate: this.reclamationForm.reclamationDate,
      sourcePage: 'Matières',
      entityName: 'Matiere',
      entityId: item.id,
      entityLabel: this.getMatiereReclamationLabel(item),
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
        console.error('Erreur création réclamation matière :', err);
        this.reclamationErrorMessage = this.extractBackendError(
          err,
          'Erreur lors de l’envoi de la réclamation.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  getMatiereReclamationLabel(item: MatiereItem): string {
    return `${item.nomMatiere} | ${item.process}`;
  }

  getMatiereInitial(item: MatiereItem): string {
    return item.nomMatiere?.trim()?.charAt(0)?.toUpperCase() || 'M';
  }

  getMatiereImageUrl(item: MatiereItem): string {
    const rawUrl = item.imageUrl || item.photoUrl || item.image || '';

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

  normalizeProcess(value: string): string {
    return this.normalizeText(value).toUpperCase();
  }

  getCreationDateValue(item: MatiereItem): string {
    return item.createdAt ||
      item.creationDate ||
      item.createdOn ||
      item.createdDate ||
      item.dateCreation ||
      '';
  }

  formatCreationDate(item: MatiereItem): string {
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

  private sortMatieres(items: MatiereItem[]): MatiereItem[] {
    return [...items].sort((a, b) => {
      let comparison = 0;

      if (this.sortField === 'nomMatiere') {
        comparison = this.normalizeText(a.nomMatiere).localeCompare(
          this.normalizeText(b.nomMatiere),
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

  private getSortableDateValue(item: MatiereItem): number {
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

  private rebuildProcessOptions(): void {
    const options = new Set<string>();

    this.matieres.forEach(item => {
      if (item.process) {
        options.add(item.process);
      }
    });

    this.processOptions = Array.from(options)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
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

    if (savedSortField === 'nomMatiere' || savedSortField === 'createdAt') {
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