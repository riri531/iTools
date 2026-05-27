import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { AuthService } from '../../../core/services/auth';

interface DesignationItem {
  id: number;
  name: string;

  type?: string | null;
  designationType?: string | null;
  category?: string | null;

  imageUrl?: string | null;
  photoUrl?: string | null;
  image?: string | null;

  createdAt?: string | null;
  creationDate?: string | null;
  createdOn?: string | null;
  createdDate?: string | null;
  dateCreation?: string | null;

  updatedAt?: string | null;
}

interface ImportedDesignationRow {
  name: string;
  type?: string;
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

type DesignationViewMode = 'list' | 'images';
type SortField = 'name' | 'createdAt';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-designations',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  templateUrl: './designations.html',
  styleUrl: './designations.scss'
})
export class DesignationsComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  private apiUrl = 'http://localhost:5160/api/Designations';
  private reclamationsUrl = 'http://localhost:5160/api/Reclamations';
  private baseUrl = 'http://localhost:5160';
  private viewModeStorageKey = 'itools_designations_view_mode';
  private sortFieldStorageKey = 'itools_designations_sort_field';
  private sortDirectionStorageKey = 'itools_designations_sort_direction';

  designations: DesignationItem[] = [];
  filteredDesignations: DesignationItem[] = [];

  viewMode: DesignationViewMode = 'list';
  searchText = '';
  selectedType = '';
  typeOptions: string[] = [];

  sortField: SortField = 'name';
  sortDirection: SortDirection = 'asc';

  designationTypeChoices = [
    'Cadre',
    'Écran',
    'Gabarit',
    'Carte',
    'Table',
    'Serrage',
    'Vague',
    'Test',
    'Matière',
    'Outillage',
    'Général',
    'Autre'
  ];

  showModal = false;
  showImportModal = false;
  showReclamationModal = false;

  selectedImportFile: File | null = null;
  importErrorMessage = '';
  importSuccessMessage = '';

  selectedReclamationDesignation: DesignationItem | null = null;
  reclamationErrorMessage = '';
  reclamationSuccessMessage = '';

  reclamationProblemTypes = [
    'Erreur de données',
    'Désignation incorrecte',
    'Désignation manquante',
    'Doublon',
    'Problème affectation',
    'Image incorrecte',
    'Type incorrect',
    'Autre'
  ];

  priorityOptions = ['BASSE', 'NORMALE', 'HAUTE', 'URGENTE'];

  reclamationForm = {
    title: '',
    problemType: 'Erreur de données',
    description: '',
    reclamationDate: '',
    priority: 'NORMALE'
  };

  form = {
    id: 0,
    name: '',
    type: '',
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
    this.restoreViewMode();
    this.restoreSortPreferences();
    this.loadDesignations();
  }

  canManageData(): boolean {
    const role = String(this.authService.getRole() || localStorage.getItem('role') || '').toUpperCase();
    return role === 'ADMIN' || role === 'RESPONSABLE';
  }
  canCreateReclamation(): boolean {
    const role = String(this.authService.getRole() || localStorage.getItem('role') || '').toUpperCase();
    return role === 'ADMIN' || role === 'RESPONSABLE';
  }
  canDownloadDesignationCard(): boolean {
    const role = String(this.authService.getRole() || localStorage.getItem('role') || '').toUpperCase();
    return role === 'ADMIN' || role === 'RESPONSABLE' || role === 'EMPLOYE' || role === 'EMPLOYÉ';
  }


  goToDesignationOutils(item: DesignationItem): void {
    this.router.navigate(['/app/outillages', item.id, 'outils']);
  }


  loadDesignations(): void {
    this.http.get<DesignationItem[]>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.designations = data || [];
        this.rebuildTypeOptions();
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Erreur chargement désignations :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des outillages.'));
      }
    });
  }

  setViewMode(mode: DesignationViewMode): void {
    this.viewMode = mode;
    localStorage.setItem(this.viewModeStorageKey, mode);
    this.cdr.detectChanges();
  }

  toggleSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = field === 'name' ? 'asc' : 'desc';
    }

    this.saveSortPreferences();
    this.applyFilters();
  }

  applyFilters(): void {
    const search = this.normalizeText(this.searchText);

    const filtered = this.designations.filter(item => {
      const type = this.getDesignationType(item);
      const creationDateLabel = this.formatCreationDate(item);

      const matchesSearch =
        !search ||
        this.normalizeText(String(item.id)).includes(search) ||
        this.normalizeText(item.name).includes(search) ||
        this.normalizeText(type).includes(search) ||
        this.normalizeText(creationDateLabel).includes(search);

      const matchesType =
        !this.selectedType ||
        type === this.selectedType;

      return matchesSearch && matchesType;
    });

    this.filteredDesignations = this.sortDesignations(filtered);
    this.saveSortPreferences();
    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.searchText = '';
    this.selectedType = '';
    this.sortField = 'name';
    this.sortDirection = 'asc';
    this.saveSortPreferences();
    this.applyFilters();
  }

  openCreateModal(): void {
    if (!this.canManageData()) {
      this.showError("Vous n'avez pas le droit d'ajouter des éléments.");
      return;
    }

    this.resetForm();
    this.form.createdAt = this.getTodayForInput();
    this.isEditMode = false;
    this.showModal = true;
    this.cdr.detectChanges();
  }

  openEditModal(item: DesignationItem): void {
    if (!this.canManageData()) {
      this.showError("Vous n'avez pas le droit de modifier des éléments.");
      return;
    }

    this.form = {
      id: item.id,
      name: item.name,
      type: this.getDesignationType(item),
      createdAt: this.toDateInputValue(this.getCreationDateValue(item)),
      imageUrl: this.getDesignationImageUrl(item),
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

  submit(): void {
    if (!this.canManageData()) {
      this.showError("Vous n'avez pas le droit d'enregistrer des modifications.");
      return;
    }

    this.errorMessage = '';

    if (!this.form.name.trim()) {
      this.showError('Le nom de la désignation est obligatoire.');
      return;
    }

    if (!this.form.type.trim()) {
      this.showError('Le type de la désignation est obligatoire.');
      return;
    }

    if (!this.form.createdAt) {
      this.showError('La date de création est obligatoire.');
      return;
    }

    const formData = this.buildDesignationFormData();

    if (this.isEditMode) {
      this.http.put<void>(`${this.apiUrl}/${this.form.id}`, formData, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Désignation modifiée avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadDesignations();
            this.resetForm();
          }, 100);
        },
        error: (err: any) => {
          console.error('Erreur modification désignation :', err);
          this.showError(this.extractBackendError(err, 'Erreur lors de la modification.'));
        }
      });
    } else {
      this.http.post<DesignationItem>(this.apiUrl, formData, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Désignation ajoutée avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadDesignations();
            this.resetForm();
          }, 100);
        },
        error: (err: any) => {
          console.error('Erreur création désignation :', err);
          this.showError(this.extractBackendError(err, 'Erreur lors de la création.'));
        }
      });
    }
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

  deleteDesignation(item: DesignationItem): void {
    if (!this.canManageData()) {
      this.showError("Vous n'avez pas le droit de supprimer des éléments.");
      return;
    }

    const confirmed = confirm(`Supprimer la désignation "${item.name}" ?`);

    if (!confirmed) {
      return;
    }

    this.http.delete<void>(`${this.apiUrl}/${item.id}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showSuccess('Désignation supprimée avec succès.');

        setTimeout(() => {
          this.loadDesignations();

          if (this.form.id === item.id) {
            this.resetForm();
          }
        }, 100);
      },
      error: (err: any) => {
        console.error('Erreur suppression désignation :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors de la suppression.'));
      }
    });
  }

  resetForm(): void {
    this.form = {
      id: 0,
      name: '',
      type: '',
      createdAt: '',
      imageUrl: '',
      imagePreview: '',
      imageFile: null,
      removeImage: false
    };

    this.isEditMode = false;
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

  importDesignations(): void {
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

        const designations: ImportedDesignationRow[] = rows
          .map(row => {
            const name = String(
              row.name ||
              row.Name ||
              row.nom ||
              row.Nom ||
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

            const type = String(
              row.type ||
              row.Type ||
              row.designationType ||
              row.DesignationType ||
              row.category ||
              row.Category ||
              row.categorie ||
              row.Categorie ||
              row.catégorie ||
              row.Catégorie ||
              ''
            ).trim();

            const createdAt = String(
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
            ).trim();

            return {
              name,
              type,
              createdAt
            };
          })
          .filter(item => item.name.length > 0);

        if (designations.length === 0) {
          this.importErrorMessage = 'Aucune désignation valide trouvée dans le fichier.';
          this.cdr.detectChanges();
          return;
        }

        this.createImportedDesignations(designations);
      } catch (error) {
        console.error('Erreur lecture fichier import désignations :', error);
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

  downloadTemplate(): void {
    const rows = [
      {
        name: '',
        type: '',
        createdAt: ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 40 },
      { wch: 24 },
      { wch: 24 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'DesignationsTemplate');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'modele_import_designations.xlsx');
  }

  downloadDesignationsData(): void {
    const rows = this.filteredDesignations.map(item => ({
      id: item.id,
      name: item.name,
      type: this.getDesignationType(item),
      createdAt: this.formatCreationDate(item),
      updatedAt: item.updatedAt || '',
      imageUrl: this.getDesignationImageUrl(item)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 40 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 48 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Designations');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'designations_export.xlsx');
  }

  downloadDesignationCard(item: DesignationItem): void {
    if (!this.canDownloadDesignationCard()) {
      this.showError("Vous n'avez pas le droit de télécharger la fiche PDF.");
      return;
    }

    this.http.get(`${this.apiUrl}/${item.id}/identity-card`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        saveAs(blob, `fiche_designation_${item.id}_${this.safeFileName(item.name)}.pdf`);
      },
      error: (err: any) => {
        console.error('Erreur téléchargement fiche désignation :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du téléchargement de la fiche PDF.'));
      }
    });
  }

  openReclamationModal(item: DesignationItem): void {
    if (!this.canCreateReclamation()) {
      this.showError("Vous n'avez pas le droit de passer une réclamation.");
      return;
    }

    this.selectedReclamationDesignation = item;
    this.reclamationErrorMessage = '';
    this.reclamationSuccessMessage = '';

    this.reclamationForm = {
      title: `Réclamation désignation : ${item.name}`,
      problemType: 'Erreur de données',
      description: `Réclamation concernant la désignation ${item.name}.`,
      reclamationDate: this.getTodayForInput(),
      priority: 'NORMALE'
    };

    this.showReclamationModal = true;
    this.cdr.detectChanges();
  }

  closeReclamationModal(): void {
    this.showReclamationModal = false;
    this.selectedReclamationDesignation = null;
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

    if (!this.selectedReclamationDesignation) {
      this.reclamationErrorMessage = 'Aucune désignation sélectionnée.';
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

    const item = this.selectedReclamationDesignation;

    const payload: CreateReclamationRequest = {
      title: this.reclamationForm.title.trim(),
      problemType: this.reclamationForm.problemType.trim(),
      description: this.reclamationForm.description.trim(),
      reclamationDate: this.reclamationForm.reclamationDate,
      sourcePage: 'Outillages',
      entityName: 'Designation',
      entityId: item.id,
      entityLabel: this.getDesignationReclamationLabel(item),
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
        console.error('Erreur création réclamation désignation :', err);
        this.reclamationErrorMessage = this.extractBackendError(
          err,
          'Erreur lors de l’envoi de la réclamation.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  getDesignationReclamationLabel(item: DesignationItem): string {
    return item.name;
  }

  getDesignationImageUrl(item: DesignationItem): string {
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

  getDesignationInitial(item: DesignationItem): string {
    return item.name?.trim()?.charAt(0)?.toUpperCase() || 'D';
  }

  getDesignationType(item: DesignationItem): string {
    const fromBackend = (
      item.type ||
      item.designationType ||
      item.category ||
      ''
    ).trim();

    if (fromBackend) {
      return fromBackend;
    }

    return this.inferTypeFromName(item.name);
  }

  getCreationDateValue(item: DesignationItem): string {
    return item.createdAt ||
      item.creationDate ||
      item.createdOn ||
      item.createdDate ||
      item.dateCreation ||
      '';
  }

  formatCreationDate(item: DesignationItem): string {
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

  private buildDesignationFormData(): FormData {
    const formData = new FormData();

    formData.append('Name', this.form.name.trim());
    formData.append('Type', this.form.type.trim());
    formData.append('CreatedAt', this.form.createdAt);
    formData.append('RemoveImage', String(this.form.removeImage));

    if (this.form.imageFile) {
      formData.append('Image', this.form.imageFile);
    }

    return formData;
  }

  private sortDesignations(items: DesignationItem[]): DesignationItem[] {
    return [...items].sort((a, b) => {
      let comparison = 0;

      if (this.sortField === 'name') {
        comparison = this.normalizeText(a.name).localeCompare(
          this.normalizeText(b.name),
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

  private getSortableDateValue(item: DesignationItem): number {
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

  private createImportedDesignations(designations: ImportedDesignationRow[]): void {
    let successCount = 0;
    let errorCount = 0;
    let completed = 0;
    const backendErrors: string[] = [];

    designations.forEach((designation, index) => {
      const formData = new FormData();

      formData.append('Name', designation.name);
      formData.append('Type', designation.type?.trim() || this.inferTypeFromName(designation.name));
      formData.append('CreatedAt', designation.createdAt?.trim() || this.getTodayForInput());
      formData.append('RemoveImage', 'false');

      this.http.post<DesignationItem>(this.apiUrl, formData, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          successCount++;
          completed++;
          this.finishImportIfDone(completed, designations.length, successCount, errorCount, backendErrors);
        },
        error: (err: any) => {
          const backendMessage = this.extractBackendError(
            err,
            `Erreur backend sur la ligne ${index + 1}.`
          );

          backendErrors.push(`Ligne ${index + 1} : ${backendMessage}`);

          errorCount++;
          completed++;
          this.finishImportIfDone(completed, designations.length, successCount, errorCount, backendErrors);
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
      this.showSuccess(`${successCount} désignation(s) importée(s) avec succès.`);

      setTimeout(() => {
        this.loadDesignations();
        this.closeImportModal();
      }, 800);
    } else {
      const details = backendErrors.length > 0
        ? ` Détail : ${backendErrors[0]}`
        : '';

      this.importErrorMessage =
        `${successCount} importée(s), ${errorCount} erreur(s). Vérifiez les données.${details}`;

      this.loadDesignations();
      this.cdr.detectChanges();
    }
  }

  private rebuildTypeOptions(): void {
    const options = new Set<string>();

    this.designations.forEach(item => {
      options.add(this.getDesignationType(item));
    });

    this.designationTypeChoices.forEach(type => {
      options.add(type);
    });

    this.typeOptions = Array.from(options)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  private inferTypeFromName(name: string): string {
    const normalized = this.normalizeText(name);

    if (!normalized) {
      return 'Non renseigné';
    }

    if (normalized.includes('cadre')) {
      return 'Cadre';
    }

    if (normalized.includes('ecran') || normalized.includes('écran')) {
      return 'Écran';
    }

    if (normalized.includes('gabarit')) {
      return 'Gabarit';
    }

    if (normalized.includes('carte') || normalized.includes('cms')) {
      return 'Carte';
    }

    if (normalized.includes('table')) {
      return 'Table';
    }

    if (normalized.includes('serrage')) {
      return 'Serrage';
    }

    if (normalized.includes('vague')) {
      return 'Vague';
    }

    if (normalized.includes('test')) {
      return 'Test';
    }

    if (normalized.includes('plomb') || normalized.includes('zinc')) {
      return 'Matière';
    }

    if (normalized.includes('outil') || normalized.includes('outillage')) {
      return 'Outillage';
    }

    return 'Général';
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

    if (savedSortField === 'name' || savedSortField === 'createdAt') {
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

  private safeFileName(value: string): string {
    return this.normalizeText(value)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'designation';
  }

  private extractBackendError(err: any, fallback: string): string {
    if (!err) {
      return fallback;
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
