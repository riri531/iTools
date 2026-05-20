import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { AuthService } from '../../../core/services/auth';

interface LigneItem {
  id: number;
  nom: string;

  nomenclature?: string | null;
  category?: string | null;
  type?: string | null;

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

interface ImportedLigneRow {
  nom: string;
  nomenclature?: string;
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

type LigneViewMode = 'list' | 'images';
type SortField = 'nom' | 'createdAt';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-lignes',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  templateUrl: './lignes.html',
  styleUrl: './lignes.scss'
})
export class LignesComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);

  private apiUrl = 'http://localhost:5160/api/Lignes';
  private reclamationsUrl = 'http://localhost:5160/api/Reclamations';
  private baseUrl = 'http://localhost:5160';

  private viewModeStorageKey = 'itools_lignes_view_mode';
  private sortFieldStorageKey = 'itools_lignes_sort_field';
  private sortDirectionStorageKey = 'itools_lignes_sort_direction';

  lignes: LigneItem[] = [];
  filteredLignes: LigneItem[] = [];

  viewMode: LigneViewMode = 'list';
  searchText = '';
  selectedNomenclature = '';
  nomenclatureOptions: string[] = [];

  sortField: SortField = 'nom';
  sortDirection: SortDirection = 'asc';

  nomenclatureChoices = [
    'Production',
    'Assemblage',
    'Contrôle',
    'Maintenance',
    'Magasin',
    'Qualité',
    'Logistique',
    'Générale',
    'Autre'
  ];

  showModal = false;
  showImportModal = false;
  showReclamationModal = false;

  selectedImportFile: File | null = null;
  importErrorMessage = '';
  importSuccessMessage = '';

  selectedReclamationLigne: LigneItem | null = null;
  reclamationErrorMessage = '';
  reclamationSuccessMessage = '';

  reclamationProblemTypes = [
    'Erreur de données',
    'Ligne incorrecte',
    'Ligne manquante',
    'Doublon',
    'Problème affectation',
    'Image incorrecte',
    'Nomenclature incorrecte',
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
    nom: '',
    nomenclature: '',
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
    this.loadLignes();
  }

  canCreateReclamation(): boolean {
    const role = String(this.authService.getRole() || '').toUpperCase();
    return role === 'EMPLOYE' || role === 'EMPLOYÉ' || role === 'RESPONSABLE';
  }

  canDownloadLigneCard(): boolean {
    const role = String(this.authService.getRole() || '').toUpperCase();
    return role === 'ADMIN' || role === 'RESPONSABLE';
  }

  loadLignes(): void {
    this.http.get<LigneItem[]>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.lignes = data || [];
        this.rebuildNomenclatureOptions();
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Erreur chargement lignes :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des lignes.'));
      }
    });
  }

  setViewMode(mode: LigneViewMode): void {
    this.viewMode = mode;
    localStorage.setItem(this.viewModeStorageKey, mode);
    this.cdr.detectChanges();
  }

  toggleSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = field === 'nom' ? 'asc' : 'desc';
    }

    this.saveSortPreferences();
    this.applyFilters();
  }

  applyFilters(): void {
    const search = this.normalizeText(this.searchText);

    const filtered = this.lignes.filter(item => {
      const nomenclature = this.getLigneNomenclature(item);
      const creationDateLabel = this.formatCreationDate(item);

      const matchesSearch =
        !search ||
        this.normalizeText(String(item.id)).includes(search) ||
        this.normalizeText(item.nom).includes(search) ||
        this.normalizeText(nomenclature).includes(search) ||
        this.normalizeText(creationDateLabel).includes(search);

      const matchesNomenclature =
        !this.selectedNomenclature ||
        nomenclature === this.selectedNomenclature;

      return matchesSearch && matchesNomenclature;
    });

    this.filteredLignes = this.sortLignes(filtered);
    this.saveSortPreferences();
    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.searchText = '';
    this.selectedNomenclature = '';
    this.sortField = 'nom';
    this.sortDirection = 'asc';
    this.saveSortPreferences();
    this.applyFilters();
  }

  openCreateModal(): void {
    this.resetForm();
    this.form.createdAt = this.getTodayForInput();
    this.isEditMode = false;
    this.showModal = true;
    this.cdr.detectChanges();
  }

  openEditModal(item: LigneItem): void {
    this.form = {
      id: item.id,
      nom: item.nom,
      nomenclature: this.getLigneNomenclature(item),
      createdAt: this.toDateInputValue(this.getCreationDateValue(item)),
      imageUrl: this.getLigneImageUrl(item),
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
    this.errorMessage = '';

    if (!this.form.nom.trim()) {
      this.showError('Le nom de la ligne est obligatoire.');
      return;
    }

    if (!this.form.nomenclature.trim()) {
      this.showError('La nomenclature est obligatoire.');
      return;
    }

    if (!this.form.createdAt) {
      this.showError('La date de création est obligatoire.');
      return;
    }

    const formData = this.buildLigneFormData();

    if (this.isEditMode) {
      this.http.put<void>(`${this.apiUrl}/${this.form.id}`, formData, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Ligne modifiée avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadLignes();
            this.resetForm();
          }, 100);
        },
        error: (err: any) => {
          console.error('Erreur modification ligne :', err);
          this.showError(this.extractBackendError(err, 'Erreur lors de la modification.'));
        }
      });
    } else {
      this.http.post<LigneItem>(this.apiUrl, formData, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Ligne ajoutée avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadLignes();
            this.resetForm();
          }, 100);
        },
        error: (err: any) => {
          console.error('Erreur création ligne :', err);
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

  deleteLigne(item: LigneItem): void {
    const confirmed = confirm(`Supprimer la ligne "${item.nom}" ?`);

    if (!confirmed) {
      return;
    }

    this.http.delete<void>(`${this.apiUrl}/${item.id}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showSuccess('Ligne supprimée avec succès.');

        setTimeout(() => {
          this.loadLignes();

          if (this.form.id === item.id) {
            this.resetForm();
          }
        }, 100);
      },
      error: (err: any) => {
        console.error('Erreur suppression ligne :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors de la suppression.'));
      }
    });
  }

  resetForm(): void {
    this.form = {
      id: 0,
      nom: '',
      nomenclature: '',
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

  importLignes(): void {
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

        const lignes: ImportedLigneRow[] = rows
          .map(row => {
            const nom = String(
              row.nom ||
              row.Nom ||
              row.ligne ||
              row.Ligne ||
              row['Nom ligne'] ||
              row['nom ligne'] ||
              ''
            ).trim();

            const nomenclature = String(
              row.nomenclature ||
              row.Nomenclature ||
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
              nom,
              nomenclature,
              createdAt
            };
          })
          .filter(item => item.nom.length > 0);

        if (lignes.length === 0) {
          this.importErrorMessage = 'Aucune ligne valide trouvée dans le fichier.';
          this.cdr.detectChanges();
          return;
        }

        this.createImportedLignes(lignes);
      } catch (error) {
        console.error('Erreur lecture fichier import lignes :', error);
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
        nom: '',
        nomenclature: '',
        createdAt: ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 30 },
      { wch: 24 },
      { wch: 24 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'LignesTemplate');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'modele_import_lignes.xlsx');
  }

  downloadLignesData(): void {
    const rows = this.filteredLignes.map(item => ({
      id: item.id,
      nom: item.nom,
      nomenclature: this.getLigneNomenclature(item),
      createdAt: this.formatCreationDate(item),
      updatedAt: item.updatedAt || '',
      imageUrl: this.getLigneImageUrl(item)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 30 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 48 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Lignes');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'lignes_export.xlsx');
  }

  downloadLigneCard(item: LigneItem): void {
    if (!this.canDownloadLigneCard()) {
      this.showError("Vous n'avez pas le droit de télécharger la fiche PDF.");
      return;
    }

    this.http.get(`${this.apiUrl}/${item.id}/identity-card`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        saveAs(blob, `fiche_ligne_${item.id}_${this.safeFileName(item.nom)}.pdf`);
      },
      error: (err: any) => {
        console.error('Erreur téléchargement fiche ligne :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du téléchargement de la fiche PDF.'));
      }
    });
  }

  openReclamationModal(item: LigneItem): void {
    if (!this.canCreateReclamation()) {
      this.showError("Vous n'avez pas le droit de passer une réclamation.");
      return;
    }

    this.selectedReclamationLigne = item;
    this.reclamationErrorMessage = '';
    this.reclamationSuccessMessage = '';

    this.reclamationForm = {
      title: `Réclamation ligne : ${item.nom}`,
      problemType: 'Erreur de données',
      description: `Réclamation concernant la ligne ${item.nom}.`,
      reclamationDate: this.getTodayForInput(),
      priority: 'NORMALE'
    };

    this.showReclamationModal = true;
    this.cdr.detectChanges();
  }

  closeReclamationModal(): void {
    this.showReclamationModal = false;
    this.selectedReclamationLigne = null;
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

    if (!this.selectedReclamationLigne) {
      this.reclamationErrorMessage = 'Aucune ligne sélectionnée.';
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

    const item = this.selectedReclamationLigne;

    const payload: CreateReclamationRequest = {
      title: this.reclamationForm.title.trim(),
      problemType: this.reclamationForm.problemType.trim(),
      description: this.reclamationForm.description.trim(),
      reclamationDate: this.reclamationForm.reclamationDate,
      sourcePage: 'Lignes',
      entityName: 'Ligne',
      entityId: item.id,
      entityLabel: this.getLigneReclamationLabel(item),
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
        console.error('Erreur création réclamation ligne :', err);
        this.reclamationErrorMessage = this.extractBackendError(
          err,
          'Erreur lors de l’envoi de la réclamation.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  getLigneReclamationLabel(item: LigneItem): string {
    return item.nom;
  }

  getLigneImageUrl(item: LigneItem): string {
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

  getLigneInitial(item: LigneItem): string {
    return item.nom?.trim()?.charAt(0)?.toUpperCase() || 'L';
  }

  getLigneNomenclature(item: LigneItem): string {
    const fromBackend = (
      item.nomenclature ||
      item.category ||
      item.type ||
      ''
    ).trim();

    if (fromBackend) {
      return fromBackend;
    }

    return this.inferNomenclatureFromName(item.nom);
  }

  getCreationDateValue(item: LigneItem): string {
    return item.createdAt ||
      item.creationDate ||
      item.createdOn ||
      item.createdDate ||
      item.dateCreation ||
      '';
  }

  formatCreationDate(item: LigneItem): string {
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

  private buildLigneFormData(): FormData {
    const formData = new FormData();

    formData.append('Nom', this.form.nom.trim());
    formData.append('Nomenclature', this.form.nomenclature.trim());
    formData.append('CreatedAt', this.form.createdAt);
    formData.append('RemoveImage', String(this.form.removeImage));

    if (this.form.imageFile) {
      formData.append('Image', this.form.imageFile);
    }

    return formData;
  }

  private sortLignes(items: LigneItem[]): LigneItem[] {
    return [...items].sort((a, b) => {
      let comparison = 0;

      if (this.sortField === 'nom') {
        comparison = this.normalizeText(a.nom).localeCompare(
          this.normalizeText(b.nom),
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

  private getSortableDateValue(item: LigneItem): number {
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

  private createImportedLignes(lignes: ImportedLigneRow[]): void {
    let successCount = 0;
    let errorCount = 0;
    let completed = 0;
    const backendErrors: string[] = [];

    lignes.forEach((ligne, index) => {
      const formData = new FormData();

      formData.append('Nom', ligne.nom);
      formData.append('Nomenclature', ligne.nomenclature?.trim() || this.inferNomenclatureFromName(ligne.nom));
      formData.append('CreatedAt', ligne.createdAt?.trim() || this.getTodayForInput());
      formData.append('RemoveImage', 'false');

      this.http.post<LigneItem>(this.apiUrl, formData, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          successCount++;
          completed++;
          this.finishImportIfDone(completed, lignes.length, successCount, errorCount, backendErrors);
        },
        error: (err: any) => {
          const backendMessage = this.extractBackendError(
            err,
            `Erreur backend sur la ligne ${index + 1}.`
          );

          backendErrors.push(`Ligne ${index + 1} : ${backendMessage}`);

          errorCount++;
          completed++;
          this.finishImportIfDone(completed, lignes.length, successCount, errorCount, backendErrors);
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
      this.showSuccess(`${successCount} ligne(s) importée(s) avec succès.`);

      setTimeout(() => {
        this.loadLignes();
        this.closeImportModal();
      }, 800);
    } else {
      const details = backendErrors.length > 0
        ? ` Détail : ${backendErrors[0]}`
        : '';

      this.importErrorMessage =
        `${successCount} importée(s), ${errorCount} erreur(s). Vérifiez les données.${details}`;

      this.loadLignes();
      this.cdr.detectChanges();
    }
  }

  private rebuildNomenclatureOptions(): void {
    const options = new Set<string>();

    this.lignes.forEach(item => {
      options.add(this.getLigneNomenclature(item));
    });

    this.nomenclatureChoices.forEach(nomenclature => {
      options.add(nomenclature);
    });

    this.nomenclatureOptions = Array.from(options)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  private inferNomenclatureFromName(name: string): string {
    const normalized = this.normalizeText(name);

    if (!normalized) {
      return 'Non renseignée';
    }

    if (normalized.includes('prod') || normalized.includes('ligne 1') || normalized.includes('ligne 2')) {
      return 'Production';
    }

    if (normalized.includes('assembl')) {
      return 'Assemblage';
    }

    if (normalized.includes('controle') || normalized.includes('contrôle') || normalized.includes('qualite') || normalized.includes('qualité')) {
      return 'Contrôle';
    }

    if (normalized.includes('maint')) {
      return 'Maintenance';
    }

    if (normalized.includes('magasin')) {
      return 'Magasin';
    }

    if (normalized.includes('logistique')) {
      return 'Logistique';
    }

    return 'Générale';
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

    if (savedSortField === 'nom' || savedSortField === 'createdAt') {
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
      .replace(/^_+|_+$/g, '') || 'ligne';
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