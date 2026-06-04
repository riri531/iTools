import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { UserService, UserItem, RoleItem } from '../../../core/services/user';
import { AuthService } from '../../../core/services/auth';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface ImportedUserRow {
  fullName: string;
  email: string;
  password: string;
  roleName: string;
  createdAt?: string;
}

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
  private authService = inject(AuthService);
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
    roleId: 0,
    createdAt: '',
    profilePhotoUrl: '',
    imagePreview: '',
    imageFile: null as File | null,
    removeImage: false
  };

  passwordVisible = true;

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

  canDownloadUserCard(): boolean {
    const role = String(this.authService.getRole() || '').toUpperCase();
    return role === 'ADMIN' || role === 'RESPONSABLE';
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
    this.passwordVisible = true;

    if (!this.form.password) {
      this.generatePassword();
    }

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
      roleId: role ? role.id : item.roleId || 0,
      createdAt: this.toDateInputValue(this.getCreationDateValue(item)),
      profilePhotoUrl: this.getUserImageUrl(item),
      imagePreview: '',
      imageFile: null,
      removeImage: false
    };

    this.isEditMode = true;
    this.passwordVisible = false;
    this.errorMessage = '';
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal(): void {
    this.showModal = false;
    this.errorMessage = '';
    this.passwordVisible = true;
    this.cdr.detectChanges();
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
    this.form.profilePhotoUrl = '';
    this.form.removeImage = true;
    this.cdr.detectChanges();
  }


  generatePassword(): void {
    this.form.password = this.generateStrongPassword();
    this.passwordVisible = true;
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
    this.cdr.detectChanges();
  }

  getPasswordStrengthLabel(): string {
    const score = this.getPasswordScore(this.form.password);

    if (!this.form.password) {
      return 'Non généré';
    }

    if (score >= 5) {
      return 'Très fort';
    }

    if (score >= 4) {
      return 'Fort';
    }

    if (score >= 3) {
      return 'Moyen';
    }

    return 'Faible';
  }

  getPasswordStrengthClass(): string {
    const score = this.getPasswordScore(this.form.password);

    if (!this.form.password) {
      return 'empty';
    }

    if (score >= 5) {
      return 'very-strong';
    }

    if (score >= 4) {
      return 'strong';
    }

    if (score >= 3) {
      return 'medium';
    }

    return 'weak';
  }

  passwordHasMinLength(): boolean {
    return this.form.password.length >= 12;
  }

  passwordHasUppercase(): boolean {
    return /[A-Z]/.test(this.form.password);
  }

  passwordHasLowercase(): boolean {
    return /[a-z]/.test(this.form.password);
  }

  passwordHasDigit(): boolean {
    return /\d/.test(this.form.password);
  }

  passwordHasSpecial(): boolean {
    return /[!@#$%^&*()_\-+=\[\]{};:,.?]/.test(this.form.password);
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

        const users: ImportedUserRow[] = rows
          .map(row => {
            const fullName = String(
              row.fullName ||
              row.FullName ||
              row['Nom complet'] ||
              row['nom complet'] ||
              row.name ||
              row.Name ||
              ''
            ).trim();

            const email = String(
              row.email ||
              row.Email ||
              row.mail ||
              row.Mail ||
              ''
            ).trim();

            const password = String(
              row.password ||
              row.Password ||
              row['Mot de passe'] ||
              row['mot de passe'] ||
              ''
            ).trim();

            const roleName = String(
              row.roleName ||
              row.RoleName ||
              row.role ||
              row.Role ||
              row['Rôle'] ||
              row['rôle'] ||
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
              fullName,
              email,
              password,
              roleName,
              createdAt
            };
          })
          .filter(item =>
            item.fullName.length > 0 &&
            item.email.length > 0 &&
            item.password.length > 0 &&
            item.roleName.length > 0
          );

        if (users.length === 0) {
          this.importErrorMessage = 'Aucun utilisateur valide trouvé dans le fichier.';
          this.cdr.detectChanges();
          return;
        }

        this.createImportedUsers(users);
      } catch (error) {
        console.error('Erreur lecture fichier import utilisateurs :', error);
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

  private createImportedUsers(users: ImportedUserRow[]): void {
    let successCount = 0;
    let errorCount = 0;
    let completed = 0;
    const backendErrors: string[] = [];

    users.forEach((user, index) => {
      const role = this.roles.find(r =>
        this.normalizeText(r.name) === this.normalizeText(user.roleName)
      );

      if (!role) {
        backendErrors.push(`Ligne ${index + 1} : rôle introuvable (${user.roleName}).`);
        errorCount++;
        completed++;
        this.finishImportIfDone(completed, users.length, successCount, errorCount, backendErrors);
        return;
      }

      const formData = new FormData();

      formData.append('FullName', user.fullName);
      formData.append('Email', user.email);
      formData.append('Password', user.password);
      formData.append('RoleId', String(role.id));
      formData.append('CreatedAt', user.createdAt?.trim() || this.getTodayForInput());
      formData.append('RemoveImage', 'false');

      this.userService.createUser(formData).subscribe({
        next: () => {
          successCount++;
          completed++;
          this.finishImportIfDone(completed, users.length, successCount, errorCount, backendErrors);
        },
        error: (err: any) => {
          const backendMessage = this.extractBackendError(
            err,
            `Erreur backend sur la ligne ${index + 1}.`
          );

          backendErrors.push(`Ligne ${index + 1} : ${backendMessage}`);

          errorCount++;
          completed++;
          this.finishImportIfDone(completed, users.length, successCount, errorCount, backendErrors);
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
      this.showSuccess(`${successCount} utilisateur(s) importé(s) avec succès.`);

      setTimeout(() => {
        this.loadUsers();
        this.closeImportModal();
      }, 800);
    } else {
      const details = backendErrors.length > 0
        ? ` Détail : ${backendErrors[0]}`
        : '';

      this.importErrorMessage =
        `${successCount} importé(s), ${errorCount} erreur(s). Vérifiez les données.${details}`;

      this.loadUsers();
      this.cdr.detectChanges();
    }
  }

  downloadTemplate(): void {
    const rows = [
      {
        fullName: '',
        email: '',
        password: '',
        roleName: '',
        createdAt: ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 30 },
      { wch: 20 },
      { wch: 18 },
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
      updatedAt: (user as any).updatedAt || '',
      profilePhotoUrl: this.getUserImageUrl(user)
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 28 },
      { wch: 34 },
      { wch: 18 },
      { wch: 24 },
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

  downloadUserCard(item: UserItem): void {
    if (!this.canDownloadUserCard()) {
      this.showError("Vous n'avez pas le droit de télécharger la fiche PDF.");
      return;
    }

    this.userService.downloadUserCard(item.id).subscribe({
      next: (blob) => {
        saveAs(blob, `fiche_utilisateur_${item.id}_${this.safeFileName(item.fullName)}.pdf`);
      },
      error: (err: any) => {
        console.error('Erreur téléchargement fiche utilisateur :', err);
        this.showError(this.extractBackendError(err, 'Erreur lors du téléchargement de la fiche PDF.'));
      }
    });
  }

  resetForm(): void {
    this.form = {
      id: 0,
      fullName: '',
      email: '',
      password: this.generateStrongPassword(),
      roleId: this.roles.length > 0 ? this.roles[0].id : 0,
      createdAt: this.getTodayForInput(),
      profilePhotoUrl: '',
      imagePreview: '',
      imageFile: null,
      removeImage: false
    };

    this.isEditMode = false;
    this.passwordVisible = true;
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
      this.showError('Le mot de passe est obligatoire. Cliquez sur “Générer” pour créer un mot de passe sécurisé.');
      return;
    }

    if (this.form.password.trim() && !this.isPasswordSecure(this.form.password.trim())) {
      this.showError('Le mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.');
      return;
    }

    if (!this.form.roleId) {
      this.showError('Le rôle est obligatoire.');
      return;
    }

    const formData = this.buildUserFormData();

    if (this.isEditMode) {
      this.userService.updateUser(this.form.id, formData).subscribe({
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
      this.userService.createUser(formData).subscribe({
        next: () => {
          this.showSuccess('Utilisateur ajouté avec succès. Un email contenant le mot de passe temporaire a été envoyé.');
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
      userAsAny.profilePhotoUrl ||
      userAsAny.imageUrl ||
      userAsAny.photoUrl ||
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

  private buildUserFormData(): FormData {
    const formData = new FormData();

    formData.append('FullName', this.form.fullName.trim());
    formData.append('Email', this.form.email.trim());
    formData.append('RoleId', String(Number(this.form.roleId)));
    formData.append('CreatedAt', this.form.createdAt || this.getTodayForInput());
    formData.append('RemoveImage', String(this.form.removeImage));

    if (this.form.password && this.form.password.trim() !== '') {
      formData.append('Password', this.form.password.trim());
    }

    if (this.form.imageFile) {
      formData.append('Image', this.form.imageFile);
    }

    return formData;
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


  private generateStrongPassword(): string {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const specials = '!@#$%^&*()-_=+?';
    const all = uppercase + lowercase + digits + specials;

    const passwordChars = [
      this.pickRandomChar(uppercase),
      this.pickRandomChar(lowercase),
      this.pickRandomChar(digits),
      this.pickRandomChar(specials)
    ];

    while (passwordChars.length < 14) {
      passwordChars.push(this.pickRandomChar(all));
    }

    return this.shuffle(passwordChars).join('');
  }

  private pickRandomChar(source: string): string {
    const index = Math.floor(Math.random() * source.length);
    return source.charAt(index);
  }

  private shuffle(values: string[]): string[] {
    return values
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(item => item.value);
  }

  private isPasswordSecure(password: string): boolean {
    return password.length >= 12 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password) &&
      /[!@#$%^&*()_\-+=\[\]{};:,.?]/.test(password);
  }

  private getPasswordScore(password: string): number {
    if (!password) {
      return 0;
    }

    let score = 0;

    if (password.length >= 12) {
      score++;
    }

    if (/[A-Z]/.test(password)) {
      score++;
    }

    if (/[a-z]/.test(password)) {
      score++;
    }

    if (/\d/.test(password)) {
      score++;
    }

    if (/[!@#$%^&*()_\-+=\[\]{};:,.?]/.test(password)) {
      score++;
    }

    return score;
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
      .replace(/^_+|_+$/g, '') || 'utilisateur';
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