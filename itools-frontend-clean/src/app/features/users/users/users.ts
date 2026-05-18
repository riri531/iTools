import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { UserService, UserItem, RoleItem } from '../../../core/services/user';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

type UserViewMode = 'list' | 'images';
type SortField = 'fullName' | 'createdAt';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  templateUrl: './users.html',
  styleUrl: './users.scss'
})
export class UsersComponent implements OnInit {
  private userService = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  private baseUrl = 'http://localhost:5160';

  private viewModeStorageKey = 'itools_users_view_mode';
  private sortFieldStorageKey = 'itools_users_sort_field';
  private sortDirectionStorageKey = 'itools_users_sort_direction';

  users: UserItem[] = [];
  filteredUsers: UserItem[] = [];
  roles: RoleItem[] = [];

  viewMode: UserViewMode = 'list';
  searchText = '';
  selectedRole = '';
  roleOptions: string[] = [];

  sortField: SortField = 'fullName';
  sortDirection: SortDirection = 'asc';

  showModal = false;
  showImportModal = false;

  selectedImportFile: File | null = null;
  importErrorMessage = '';
  importSuccessMessage = '';

  form = {
    id: 0,
    fullName: '',
    email: '',
    password: '',
    roleId: 0
  };

  isEditMode = false;
  successMessage = '';
  errorMessage = '';

  private successTimeout: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.restoreViewMode();
    this.restoreSortPreferences();
    this.loadUsers();
    this.loadRoles();
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe({
      next: (data) => {
        this.users = data || [];
        this.rebuildRoleOptions();
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error(err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des utilisateurs.'));
      }
    });
  }

  loadRoles(): void {
    this.userService.getRoles().subscribe({
      next: (data) => {
        this.roles = data || [];

        if (!this.form.roleId && this.roles.length > 0) {
          this.form.roleId = this.roles[0].id;
        }

        this.rebuildRoleOptions();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error(err);
        this.showError(this.extractBackendError(err, 'Erreur lors du chargement des rôles.'));
      }
    });
  }

  setViewMode(mode: UserViewMode): void {
    this.viewMode = mode;
    localStorage.setItem(this.viewModeStorageKey, mode);
    this.cdr.detectChanges();
  }

  toggleSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = field === 'fullName' ? 'asc' : 'desc';
    }

    this.saveSortPreferences();
    this.applyFilters();
  }

  applyFilters(): void {
    const search = this.normalizeText(this.searchText);

    const filtered = this.users.filter(item => {
      const roleName = this.getUserRoleName(item);
      const creationDateLabel = this.formatCreationDate(item);

      const matchesSearch =
        !search ||
        this.normalizeText(String(item.id)).includes(search) ||
        this.normalizeText(item.fullName).includes(search) ||
        this.normalizeText(item.email).includes(search) ||
        this.normalizeText(roleName).includes(search) ||
        this.normalizeText(creationDateLabel).includes(search);

      const matchesRole =
        !this.selectedRole ||
        roleName === this.selectedRole;

      return matchesSearch && matchesRole;
    });

    this.filteredUsers = this.sortUsers(filtered);
    this.saveSortPreferences();
    this.cdr.detectChanges();
  }

  resetFilters(): void {
    this.searchText = '';
    this.selectedRole = '';
    this.sortField = 'fullName';
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

  openEditModal(item: UserItem): void {
    const role = this.roles.find(r => r.name === item.roleName);

    this.form = {
      id: item.id,
      fullName: item.fullName,
      email: item.email,
      password: '',
      roleId: role ? role.id : 0
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

  importUsers(): void {
    this.importErrorMessage = '';
    this.importSuccessMessage = '';

    if (!this.selectedImportFile) {
      this.importErrorMessage = 'Veuillez sélectionner un fichier Excel ou CSV.';
      this.cdr.detectChanges();
      return;
    }

    this.userService.importUsers(this.selectedImportFile).subscribe({
      next: () => {
        this.importSuccessMessage = 'Import en masse effectué avec succès.';
        this.showSuccess('Import utilisateurs réussi.');

        setTimeout(() => {
          this.loadUsers();
          this.closeImportModal();
        }, 800);
      },
      error: (err: any) => {
        console.error(err);
        this.importErrorMessage = this.extractBackendError(err, 'Erreur lors de l’import.');
        this.cdr.detectChanges();
      }
    });
  }

  downloadTemplate(): void {
    const rows = [
      {
        fullName: '',
        email: '',
        password: '',
        roleName: '',
        imageUrl: '',
        createdAt: ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 30 },
      { wch: 20 },
      { wch: 18 },
      { wch: 48 },
      { wch: 24 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'UsersTemplate');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'modele_import_utilisateurs.xlsx');
  }

  downloadUsersData(): void {
    const rows = this.filteredUsers.map(user => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      roleName: user.roleName,
      createdAt: this.formatCreationDate(user),
      imageUrl: this.getUserImageUrl(user)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 28 },
      { wch: 34 },
      { wch: 18 },
      { wch: 24 },
      { wch: 48 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

    const excelBuffer: ArrayBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });

    const fileData = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(fileData, 'utilisateurs_export.xlsx');
  }

  resetForm(): void {
    this.form = {
      id: 0,
      fullName: '',
      email: '',
      password: '',
      roleId: this.roles.length > 0 ? this.roles[0].id : 0
    };

    this.isEditMode = false;
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  submit(): void {
    this.errorMessage = '';

    if (!this.form.fullName.trim()) {
      this.showError('Le nom complet est obligatoire.');
      return;
    }

    if (!this.form.email.trim()) {
      this.showError('L’email est obligatoire.');
      return;
    }

    if (!this.isEditMode && !this.form.password.trim()) {
      this.showError('Le mot de passe est obligatoire.');
      return;
    }

    if (!this.form.roleId) {
      this.showError('Le rôle est obligatoire.');
      return;
    }

    if (this.isEditMode) {
      const payload: {
        fullName: string;
        email: string;
        roleId: number;
        password?: string;
      } = {
        fullName: this.form.fullName.trim(),
        email: this.form.email.trim(),
        roleId: Number(this.form.roleId)
      };

      if (this.form.password && this.form.password.trim() !== '') {
        payload.password = this.form.password.trim();
      }

      this.userService.updateUser(this.form.id, payload).subscribe({
        next: () => {
          this.showSuccess('Utilisateur modifié avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadUsers();
            this.resetForm();
          }, 100);
        },
        error: (err: any) => {
          console.error(err);
          this.showError(this.extractBackendError(err, 'Erreur lors de la modification.'));
        }
      });
    } else {
      this.userService.createUser({
        fullName: this.form.fullName.trim(),
        email: this.form.email.trim(),
        password: this.form.password.trim(),
        roleId: Number(this.form.roleId)
      }).subscribe({
        next: () => {
          this.showSuccess('Utilisateur ajouté avec succès.');
          this.closeModal();

          setTimeout(() => {
            this.loadUsers();
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

  deleteUser(item: UserItem): void {
    const confirmed = confirm(`Supprimer l'utilisateur "${item.fullName}" ?`);

    if (!confirmed) {
      return;
    }

    this.userService.deleteUser(item.id).subscribe({
      next: () => {
        this.showSuccess('Utilisateur supprimé avec succès.');

        setTimeout(() => {
          this.loadUsers();

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

  getUserRoleName(item: UserItem): string {
    return item.roleName || 'Non renseigné';
  }

  getUserInitial(item: UserItem): string {
    return item.fullName?.trim()?.charAt(0)?.toUpperCase() || 'U';
  }

  getUserImageUrl(item: UserItem): string {
    const userAsAny = item as any;

    const rawUrl =
      userAsAny.imageUrl ||
      userAsAny.photoUrl ||
      userAsAny.profilePhotoUrl ||
      userAsAny.avatarUrl ||
      userAsAny.image ||
      userAsAny.photo ||
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

  getCreationDateValue(item: UserItem): string {
    const userAsAny = item as any;

    return userAsAny.createdAt ||
      userAsAny.creationDate ||
      userAsAny.createdOn ||
      userAsAny.createdDate ||
      userAsAny.dateCreation ||
      '';
  }

  formatCreationDate(item: UserItem): string {
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

  private sortUsers(items: UserItem[]): UserItem[] {
    return [...items].sort((a, b) => {
      let comparison = 0;

      if (this.sortField === 'fullName') {
        comparison = this.normalizeText(a.fullName).localeCompare(
          this.normalizeText(b.fullName),
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

  private getSortableDateValue(item: UserItem): number {
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

  private rebuildRoleOptions(): void {
    const options = new Set<string>();

    this.users.forEach(item => {
      const roleName = this.getUserRoleName(item);

      if (roleName) {
        options.add(roleName);
      }
    });

    this.roles.forEach(role => {
      if (role.name) {
        options.add(role.name);
      }
    });

    this.roleOptions = Array.from(options)
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

    if (savedSortField === 'fullName' || savedSortField === 'createdAt') {
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