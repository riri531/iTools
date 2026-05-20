import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { AuthService } from '../../../core/services/auth';

interface FournisseurItem {
  id: number;
  codeFournisseur: string;
  nomFournisseur: string;

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

interface ImportedFournisseurRow {
  codeFournisseur: string;
  nomFournisseur: string;
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

type FournisseurViewMode = 'list' | 'images';
type SortField = 'nomFournisseur' | 'createdAt';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-fournisseurs',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  templateUrl: './fournisseurs.html',
  styleUrl: './fournisseurs.scss'
})
export class FournisseursComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);

  private apiUrl = 'http://localhost:5160/api/Fournisseurs';
  private reclamationsUrl = 'http://localhost:5160/api/Reclamations';
  private baseUrl = 'http://localhost:5160';

  private viewModeStorageKey = 'itools_fournisseurs_view_mode';
  private sortFieldStorageKey = 'itools_fournisseurs_sort_field';
  private sortDirectionStorageKey = 'itools_fournisseurs_sort_direction';

  fournisseurs: FournisseurItem[] = [];
  filteredFournisseurs: FournisseurItem[] = [];

  viewMode: FournisseurViewMode = 'list';
  searchText = '';
  selectedNomenclature = '';
  nomenclatureOptions: string[] = [];

  sortField: SortField = 'nomFournisseur';
  sortDirection: SortDirection = 'asc';

  nomenclatureChoices = [
    'Matière première',
    'Outillage',
    'Maintenance',
    'Équipement',
    'Consommable',
    'Service',
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

  selectedReclamationFournisseur: FournisseurItem | null = null;
  reclamationErrorMessage = '';
  reclamationSuccessMessage = '';

  reclamationProblemTypes = [
    'Erreur de données',
    'Fournisseur incorrect',
    'Code fournisseur incorrect',
    'Nom fournisseur incorrect',
    'Nomenclature incorrecte',
    'Fournisseur manquant',
    'Doublon',
    'Image incorrecte',
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
    codeFournisseur: '',
    nomFournisseur: '',
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
    this.loadFournisseurs();
  }

  canCreateReclamation(): boolean {
    const role = String(this.authService.getRole() || '').toUpperCase();
    return role === 'EMPLOYE' || role === 'EMPLOYÉ' || role === 'RESPONSABLE';
  }

  canDownloadFournisseurCard(): boolean {
    const role = String(this.authService.getRole() || '').toUpperCase();
    return role === 'ADMIN' || role === 'RESPONSABLE';
  }

  loadFournisseurs(): void {
    this.http.get<FournisseurItem[]>(this.apiUrl, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.fournisseurs = data || [];
        this.rebuildNomenclatureOptions();
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Erreur chargement fournisseurs :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des fournisseurs.'));
      }
    });
  }

  setViewMode(mode: FournisseurViewMode): void {
    this.viewMode = mode;
    localStorage.setItem(this.viewModeStorageKey, mode);
    this.cdr.detectChanges();
  }

  toggleSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = field === 'nomFournisseur' ? 'asc' : 'desc';
    }

    this.saveSortPreferences();
    this.applyFilters();
  }

  applyFilters(): void {
    const search = this.normalizeText(this.searchText);

    const filtered = this.fournisseurs.filter(item => {
      const nomenclature = this.getFournisseurNomenclature(item);
      const creationDateLabel = this.formatCreationDate(item);

      const matchesSearch =
        !search ||
        this.normalizeText(String(item.id)).includes(search) ||
        this.normalizeText(item.codeFournisseur).includes(search) ||
        this.normalizeText(item.nomFournisseur).includes(search) ||
        this.normalizeText(nomenclature).includes(search) ||
        this.normalizeText(creationDateLabel).includes(search);

      const matchesNomenclature =
        !this.selectedNomenclature ||
        nomenclature === this.selectedNomenclature;

      return matchesSearch && matchesNomenclature;
    });

    this.filteredFournisseurs = this.sortFournisseurs(filtered);
    this.saveSortPreferences();
    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.searchText = '';
    this.selectedNomenclature = '';
    this.sortField = 'nomFournisseur';
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

  openEditModal(item: FournisseurItem): void {
    this.form = {
      id: item.id,
      codeFournisseur: item.codeFournisseur,
      nomFournisseur: item.nomFournisseur,
      nomenclature: this.getFournisseurNomenclature(item),
      createdAt: this.toDateInputValue(this.getCreationDateValue(item)),
      imageUrl: this.getFournisseurImageUrl(item),
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

    if (!this.form.codeFournisseur.trim()) {
      this.showError('Le code fournisseur est obligatoire.');
      return;
    }

    if (!this.form.nomFournisseur.trim()) {
      this.showError('Le nom fournisseur est obligatoire.');
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

    const formData = this.buildFournisseurFormData();

    if (this.isEditMode) {
      this.http.put<void>(`${this.apiUrl}/${this.form.id}`, formData, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Fournisseur modifié avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadFournisseurs();
            this.resetForm();
          }, 100);
        },
        error: (err: any) => {
          console.error('Erreur modification fournisseur :', err);
          this.showError(this.extractBackendError(err, 'Erreur lors de la modification.'));
        }
      });
    } else {
      this.http.post<FournisseurItem>(this.apiUrl, formData, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          this.showSuccess('Fournisseur ajouté avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadFournisseurs();
            this.resetForm();
          }, 100);
        },
        error: (err: any) => {
          console.error('Erreur création fournisseur :', err);
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

  deleteFournisseur(item: FournisseurItem): void {
    const confirmed = confirm(`Supprimer le fournisseur "${item.nomFournisseur}" ?`);

    if (!confirmed) {
      return;
    }

    this.http.delete<void>(`${this.apiUrl}/${item.id}`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showSuccess('Fournisseur supprimé avec succès.');

        setTimeout(() => {
          this.loadFournisseurs();

          if (this.form.id === item.id) {
            this.resetForm();
          }
        }, 100);
      },
      error: (err: any) => {
        console.error('Erreur suppression fournisseur :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors de la suppression.'));
      }
    });
  }

  resetForm(): void {
    this.form = {
      id: 0,
      codeFournisseur: '',
      nomFournisseur: '',
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

  importFournisseurs(): void {
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

        const fournisseurs: ImportedFournisseurRow[] = rows
          .map(row => {
            const codeFournisseur = String(
              row.codeFournisseur ||
              row.CodeFournisseur ||
              row['Code fournisseur'] ||
              row['code fournisseur'] ||
              row.code ||
              row.Code ||
              ''
            ).trim();

            const nomFournisseur = String(
              row.nomFournisseur ||
              row.NomFournisseur ||
              row['Nom fournisseur'] ||
              row['nom fournisseur'] ||
              row.fournisseur ||
              row.Fournisseur ||
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
              codeFournisseur,
              nomFournisseur,
              nomenclature,
              createdAt
            };
          })
          .filter(item =>
            item.codeFournisseur.length > 0 &&
            item.nomFournisseur.length > 0
          );

        if (fournisseurs.length === 0) {
          this.importErrorMessage = 'Aucun fournisseur valide trouvé dans le fichier.';
          this.cdr.detectChanges();
          return;
        }

        this.createImportedFournisseurs(fournisseurs);
      } catch (error) {
        console.error('Erreur lecture fichier import fournisseurs :', error);
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

  private createImportedFournisseurs(fournisseurs: ImportedFournisseurRow[]): void {
    let successCount = 0;
    let errorCount = 0;
    let completed = 0;
    const backendErrors: string[] = [];

    fournisseurs.forEach((fournisseur, index) => {
      const formData = new FormData();

      formData.append('CodeFournisseur', fournisseur.codeFournisseur);
      formData.append('NomFournisseur', fournisseur.nomFournisseur);
      formData.append('Nomenclature', fournisseur.nomenclature?.trim() || this.inferNomenclatureFromName(fournisseur.nomFournisseur));
      formData.append('CreatedAt', fournisseur.createdAt?.trim() || this.getTodayForInput());
      formData.append('RemoveImage', 'false');

      this.http.post<FournisseurItem>(this.apiUrl, formData, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => {
          successCount++;
          completed++;
          this.finishImportIfDone(completed, fournisseurs.length, successCount, errorCount, backendErrors);
        },
        error: (err: any) => {
          const backendMessage = this.extractBackendError(
            err,
            `Erreur backend sur la ligne ${index + 1}.`
          );

          backendErrors.push(`Ligne ${index + 1} : ${backendMessage}`);

          errorCount++;
          completed++;
          this.finishImportIfDone(completed, fournisseurs.length, successCount, errorCount, backendErrors);
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
      this.showSuccess(`${successCount} fournisseur(s) importé(s) avec succès.`);

      setTimeout(() => {
        this.loadFournisseurs();
        this.closeImportModal();
      }, 800);
    } else {
      const details = backendErrors.length > 0
        ? ` Détail : ${backendErrors[0]}`
        : '';

      this.importErrorMessage =
        `${successCount} importé(s), ${errorCount} erreur(s). Vérifiez les données.${details}`;

      this.loadFournisseurs();
      this.cdr.detectChanges();
    }
  }

  downloadTemplate(): void {
    const rows = [
      {
        codeFournisseur: '',
        nomFournisseur: '',
        nomenclature: '',
        createdAt: ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 28 },
      { wch: 34 },
      { wch: 28 },
      { wch: 24 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'FournisseursTemplate');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'modele_import_fournisseurs.xlsx');
  }

  downloadFournisseursData(): void {
    const rows = this.filteredFournisseurs.map(item => ({
      id: item.id,
      codeFournisseur: item.codeFournisseur,
      nomFournisseur: item.nomFournisseur,
      nomenclature: this.getFournisseurNomenclature(item),
      createdAt: this.formatCreationDate(item),
      updatedAt: item.updatedAt || '',
      imageUrl: this.getFournisseurImageUrl(item)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 28 },
      { wch: 34 },
      { wch: 28 },
      { wch: 24 },
      { wch: 24 },
      { wch: 48 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fournisseurs');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'fournisseurs_export.xlsx');
  }

  downloadFournisseurCard(item: FournisseurItem): void {
    if (!this.canDownloadFournisseurCard()) {
      this.showError("Vous n'avez pas le droit de télécharger la fiche PDF.");
      return;
    }

    this.http.get(`${this.apiUrl}/${item.id}/identity-card`, {
      headers: this.getAuthHeaders(),
      responseType: 'blob'
    }).subscribe({
      next: (blob) => {
        saveAs(blob, `fiche_fournisseur_${item.id}_${this.safeFileName(item.nomFournisseur)}.pdf`);
      },
      error: (err: any) => {
        console.error('Erreur téléchargement fiche fournisseur :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du téléchargement de la fiche PDF.'));
      }
    });
  }

  openReclamationModal(item: FournisseurItem): void {
    if (!this.canCreateReclamation()) {
      this.showError("Vous n'avez pas le droit de passer une réclamation.");
      return;
    }

    this.selectedReclamationFournisseur = item;
    this.reclamationErrorMessage = '';
    this.reclamationSuccessMessage = '';

    this.reclamationForm = {
      title: `Réclamation fournisseur : ${item.nomFournisseur}`,
      problemType: 'Erreur de données',
      description:
        `Réclamation concernant le fournisseur ${item.nomFournisseur}. ` +
        `Code fournisseur : ${item.codeFournisseur}. ` +
        `Nomenclature : ${this.getFournisseurNomenclature(item)}.`,
      reclamationDate: this.getTodayForInput(),
      priority: 'NORMALE'
    };

    this.showReclamationModal = true;
    this.cdr.detectChanges();
  }

  closeReclamationModal(): void {
    this.showReclamationModal = false;
    this.selectedReclamationFournisseur = null;
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

    if (!this.selectedReclamationFournisseur) {
      this.reclamationErrorMessage = 'Aucun fournisseur sélectionné.';
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

    const item = this.selectedReclamationFournisseur;

    const payload: CreateReclamationRequest = {
      title: this.reclamationForm.title.trim(),
      problemType: this.reclamationForm.problemType.trim(),
      description: this.reclamationForm.description.trim(),
      reclamationDate: this.reclamationForm.reclamationDate,
      sourcePage: 'Fournisseurs',
      entityName: 'Fournisseur',
      entityId: item.id,
      entityLabel: this.getFournisseurReclamationLabel(item),
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
        console.error('Erreur création réclamation fournisseur :', err);
        this.reclamationErrorMessage = this.extractBackendError(
          err,
          'Erreur lors de l’envoi de la réclamation.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  getFournisseurReclamationLabel(item: FournisseurItem): string {
    return `${item.codeFournisseur} | ${item.nomFournisseur}`;
  }

  getFournisseurNomenclature(item: FournisseurItem): string {
    const fromBackend = (
      item.nomenclature ||
      item.category ||
      item.type ||
      ''
    ).trim();

    if (fromBackend) {
      return fromBackend;
    }

    return this.inferNomenclatureFromName(item.nomFournisseur);
  }

  getFournisseurImageUrl(item: FournisseurItem): string {
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

  getFournisseurInitial(item: FournisseurItem): string {
    return item.nomFournisseur?.trim()?.charAt(0)?.toUpperCase() || 'F';
  }

  getCreationDateValue(item: FournisseurItem): string {
    return item.createdAt ||
      item.creationDate ||
      item.createdOn ||
      item.createdDate ||
      item.dateCreation ||
      '';
  }

  formatCreationDate(item: FournisseurItem): string {
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

  private buildFournisseurFormData(): FormData {
    const formData = new FormData();

    formData.append('CodeFournisseur', this.form.codeFournisseur.trim());
    formData.append('NomFournisseur', this.form.nomFournisseur.trim());
    formData.append('Nomenclature', this.form.nomenclature.trim());
    formData.append('CreatedAt', this.form.createdAt);
    formData.append('RemoveImage', String(this.form.removeImage));

    if (this.form.imageFile) {
      formData.append('Image', this.form.imageFile);
    }

    return formData;
  }

  private sortFournisseurs(items: FournisseurItem[]): FournisseurItem[] {
    return [...items].sort((a, b) => {
      let comparison = 0;

      if (this.sortField === 'nomFournisseur') {
        comparison = this.normalizeText(a.nomFournisseur).localeCompare(
          this.normalizeText(b.nomFournisseur),
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

  private getSortableDateValue(item: FournisseurItem): number {
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

  private rebuildNomenclatureOptions(): void {
    const options = new Set<string>();

    this.fournisseurs.forEach(item => {
      options.add(this.getFournisseurNomenclature(item));
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

    if (
      normalized.includes('samsung') ||
      normalized.includes('schneider') ||
      normalized.includes('siemens') ||
      normalized.includes('abb')
    ) {
      return 'Équipement';
    }

    if (
      normalized.includes('outil') ||
      normalized.includes('outillage') ||
      normalized.includes('gabarit')
    ) {
      return 'Outillage';
    }

    if (
      normalized.includes('matiere') ||
      normalized.includes('matière') ||
      normalized.includes('metal') ||
      normalized.includes('métal') ||
      normalized.includes('plastique')
    ) {
      return 'Matière première';
    }

    if (normalized.includes('maint')) {
      return 'Maintenance';
    }

    if (normalized.includes('transport') || normalized.includes('logistique')) {
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

    if (savedSortField === 'nomFournisseur' || savedSortField === 'createdAt') {
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
      .replace(/^_+|_+$/g, '') || 'fournisseur';
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