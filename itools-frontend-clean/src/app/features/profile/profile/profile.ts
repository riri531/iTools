import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

interface ProfileDto {
  id: number;
  fullName: string;
  email: string;
  role: string;
  phoneNumber: string | null;
  address: string | null;
  profilePhotoUrl: string | null;

  gender?: string | null;
  dateOfBirth?: string | null;
  postalCode?: string | null;
  factoryRegistrationNumber?: string | null;
}

type ProfileSection = 'personal' | 'photo' | 'security';
type PhotoModalMode = '' | 'view' | 'choice' | 'camera' | 'preview';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIf],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class ProfileComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('videoElement') videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement?: ElementRef<HTMLCanvasElement>;

  private apiUrl = 'http://localhost:5160/api/Profile';
  private baseUrl = 'http://localhost:5160';

  activeSection: ProfileSection = 'personal';
  photoModalMode: PhotoModalMode = '';

  isPersonalInfoModalOpen = false;

  profile: ProfileDto | null = null;

  profileForm = {
    firstName: '',
    lastName: '',
    fullName: '',
    email: '',
    phoneNumber: '',
    address: '',
    gender: '',
    dateOfBirth: '',
    postalCode: '',
    factoryRegistrationNumber: ''
  };

  passwordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  isLoadingProfile = false;
  isSavingProfile = false;
  isChangingPassword = false;
  isSendingRecoveryEmail = false;
  isUploadingPhoto = false;
  isDeletingPhoto = false;

  successMessage = '';
  errorMessage = '';

  cameraActive = false;
  private cameraStream: MediaStream | null = null;

  selectedPhotoFile: File | null = null;
  selectedPhotoPreviewUrl = '';

  ngOnInit(): void {
    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.revokeSelectedPhotoPreview();
  }

  setActiveSection(section: ProfileSection): void {
    this.activeSection = section;
    this.successMessage = '';
    this.errorMessage = '';
  }

  loadProfile(): void {
    this.isLoadingProfile = true;
    this.errorMessage = '';

    this.http.get<ProfileDto>(`${this.apiUrl}/me`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: (data) => {
        this.profile = data;
        this.syncProfileForm(data);

        this.isLoadingProfile = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = 'Erreur lors du chargement du profil.';
        this.isLoadingProfile = false;
        this.cdr.detectChanges();
      }
    });
  }

  openPersonalInfoModal(): void {
    if (this.profile) {
      this.syncProfileForm(this.profile);
    }

    this.successMessage = '';
    this.errorMessage = '';
    this.isPersonalInfoModalOpen = true;
  }

  closePersonalInfoModal(): void {
    this.isPersonalInfoModalOpen = false;

    if (this.profile) {
      this.syncProfileForm(this.profile);
    }
  }

  saveProfileFromModal(): void {
    this.saveProfile(true);
  }

  saveProfile(closeModalAfterSave = false): void {
    this.isSavingProfile = true;
    this.errorMessage = '';

    const fullName = this.buildFullName();

    if (!fullName) {
      this.errorMessage = 'Le nom et le prénom sont obligatoires.';
      this.isSavingProfile = false;
      this.cdr.detectChanges();
      return;
    }

    if (!this.profileForm.email.trim()) {
      this.errorMessage = 'L’adresse mail est obligatoire.';
      this.isSavingProfile = false;
      this.cdr.detectChanges();
      return;
    }

    const payload = {
      fullName: fullName,
      email: this.profileForm.email.trim(),
      phoneNumber: this.profileForm.phoneNumber.trim(),
      address: this.profileForm.address.trim(),

      gender: this.profileForm.gender,
      dateOfBirth: this.profileForm.dateOfBirth || null,
      postalCode: this.profileForm.postalCode.trim(),
      factoryRegistrationNumber: this.profileForm.factoryRegistrationNumber.trim()
    };

    this.http.put(`${this.apiUrl}/me`, payload, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.authService.updateCurrentUser(payload.fullName, payload.email);
        window.dispatchEvent(new Event('profile-updated'));

        this.showSuccess('Informations personnelles conservées avec succès.');
        this.isSavingProfile = false;

        if (closeModalAfterSave) {
          this.isPersonalInfoModalOpen = false;
        }

        this.loadProfile();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors de la modification du profil.'
        );
        this.isSavingProfile = false;
        this.cdr.detectChanges();
      }
    });
  }

  resetProfileForm(): void {
    if (this.profile) {
      this.syncProfileForm(this.profile);
    }
  }

  changePassword(): void {
    this.isChangingPassword = true;
    this.errorMessage = '';

    const currentPassword = this.passwordForm.currentPassword || '';
    const newPassword = this.passwordForm.newPassword || '';
    const confirmPassword = this.passwordForm.confirmPassword || '';

    if (!currentPassword.trim()) {
      this.errorMessage = 'Le mot de passe actuel est obligatoire.';
      this.isChangingPassword = false;
      this.cdr.detectChanges();
      return;
    }

    if (!newPassword.trim()) {
      this.errorMessage = 'Le nouveau mot de passe est obligatoire.';
      this.isChangingPassword = false;
      this.cdr.detectChanges();
      return;
    }

    if (newPassword.length < 8) {
      this.errorMessage = 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
      this.isChangingPassword = false;
      this.cdr.detectChanges();
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      this.errorMessage = 'Le nouveau mot de passe doit contenir au moins une lettre majuscule.';
      this.isChangingPassword = false;
      this.cdr.detectChanges();
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      this.errorMessage = 'Le nouveau mot de passe doit contenir au moins une lettre minuscule.';
      this.isChangingPassword = false;
      this.cdr.detectChanges();
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      this.errorMessage = 'Le nouveau mot de passe doit contenir au moins un chiffre.';
      this.isChangingPassword = false;
      this.cdr.detectChanges();
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>_\-+=/\\[\]`;']/.test(newPassword)) {
      this.errorMessage = 'Le nouveau mot de passe doit contenir au moins un caractère spécial.';
      this.isChangingPassword = false;
      this.cdr.detectChanges();
      return;
    }

    if (!confirmPassword.trim()) {
      this.errorMessage = 'La confirmation du mot de passe est obligatoire.';
      this.isChangingPassword = false;
      this.cdr.detectChanges();
      return;
    }

    if (newPassword !== confirmPassword) {
      this.errorMessage = 'La confirmation du mot de passe ne correspond pas.';
      this.isChangingPassword = false;
      this.cdr.detectChanges();
      return;
    }

    const payload = {
      currentPassword: currentPassword,
      newPassword: newPassword,
      confirmPassword: confirmPassword
    };

    this.http.put(`${this.apiUrl}/password`, payload, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.resetPasswordForm();

        this.showSuccess('Mot de passe modifié avec succès.');
        this.isChangingPassword = false;

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors du changement du mot de passe.'
        );
        this.isChangingPassword = false;
        this.cdr.detectChanges();
      }
    });
  }

  resetPasswordForm(): void {
    this.passwordForm = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
  }

  sendRecoveryEmail(): void {
    this.successMessage = '';
    this.errorMessage = '';

    const email = (this.profile?.email || this.authService.getEmail() || '').trim();

    if (!email) {
      this.errorMessage = 'Adresse email introuvable. Recharge le profil puis réessaie.';
      this.cdr.detectChanges();
      return;
    }

    this.isSendingRecoveryEmail = true;

    this.authService.forgotPassword({ email }).subscribe({
      next: (response) => {
        this.isSendingRecoveryEmail = false;
        this.showSuccess(
          response?.message || 'Un mail de récupération a été envoyé à ton adresse email.'
        );
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.isSendingRecoveryEmail = false;
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors de l’envoi du mail de récupération.'
        );
        this.cdr.detectChanges();
      }
    });
  }

  openViewPhotoModal(): void {
    this.photoModalMode = 'view';
  }

  openPhotoChoiceModal(): void {
    this.errorMessage = '';
    this.revokeSelectedPhotoPreview();
    this.selectedPhotoFile = null;
    this.photoModalMode = 'choice';
  }

  closePhotoModal(): void {
    this.stopCamera();
    this.photoModalMode = '';
    this.cdr.detectChanges();
  }

  openFileSelector(): void {
    this.fileInput?.nativeElement.click();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    this.prepareSelectedPhoto(file);
    input.value = '';
  }

  startCameraFromModal(): void {
    this.photoModalMode = 'camera';
    this.startCamera();
  }

  async startCamera(): Promise<void> {
    this.errorMessage = '';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.errorMessage = 'La caméra n’est pas supportée par ce navigateur.';
      this.cdr.detectChanges();
      return;
    }

    try {
      this.cameraActive = true;
      this.cdr.detectChanges();

      await new Promise(resolve => setTimeout(resolve, 250));

      const video = this.videoElement?.nativeElement;

      if (!video) {
        this.errorMessage = 'Zone vidéo introuvable. Recharge la page puis réessaie.';
        this.cameraActive = false;
        this.cdr.detectChanges();
        return;
      }

      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      video.srcObject = this.cameraStream;
      video.muted = true;
      video.playsInline = true;

      await video.play();

      this.errorMessage = '';
      this.cdr.detectChanges();
    } catch (error: any) {
      console.error('Erreur caméra :', error);

      this.stopCamera();

      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        this.errorMessage = 'Autorisation caméra refusée.';
      } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        this.errorMessage = 'Aucune caméra détectée.';
      } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
        this.errorMessage = 'La caméra est déjà utilisée par une autre application.';
      } else if (error?.name === 'OverconstrainedError') {
        this.errorMessage = 'La caméra ne supporte pas les paramètres demandés.';
      } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        this.errorMessage = 'La caméra nécessite HTTPS ou localhost.';
      } else {
        this.errorMessage = `Impossible d’accéder à la caméra. Détail : ${error?.name || 'erreur inconnue'}`;
      }

      this.photoModalMode = 'choice';
      this.cdr.detectChanges();
    }
  }

  cancelCameraModal(): void {
    this.stopCamera();
    this.photoModalMode = 'choice';
    this.cdr.detectChanges();
  }

  stopCamera(): void {
    if (this.videoElement?.nativeElement) {
      this.videoElement.nativeElement.pause();
      this.videoElement.nativeElement.srcObject = null;
    }

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }

    this.cameraActive = false;
  }

  capturePhoto(): void {
    const video = this.videoElement?.nativeElement;
    const canvas = this.canvasElement?.nativeElement;

    if (!video || !canvas) {
      this.errorMessage = 'Caméra non prête. Réessayez.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.cameraStream) {
      this.errorMessage = 'Aucun flux caméra actif.';
      this.cdr.detectChanges();
      return;
    }

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
      this.errorMessage = 'Impossible de capturer la photo.';
      this.cdr.detectChanges();
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) {
        this.errorMessage = 'Capture de photo impossible.';
        this.cdr.detectChanges();
        return;
      }

      const file = new File([blob], `profile-camera-${Date.now()}.png`, {
        type: 'image/png'
      });

      this.stopCamera();
      this.prepareSelectedPhoto(file);
    }, 'image/png');
  }

  prepareSelectedPhoto(file: File): void {
    this.revokeSelectedPhotoPreview();

    this.selectedPhotoFile = file;
    this.selectedPhotoPreviewUrl = URL.createObjectURL(file);
    this.photoModalMode = 'preview';

    this.cdr.detectChanges();
  }

  confirmSelectedPhoto(): void {
    if (!this.selectedPhotoFile) {
      this.errorMessage = 'Aucune photo sélectionnée.';
      this.cdr.detectChanges();
      return;
    }

    this.uploadPhotoFile(this.selectedPhotoFile);
  }

  reselectPhoto(): void {
    this.revokeSelectedPhotoPreview();
    this.selectedPhotoFile = null;
    this.photoModalMode = 'choice';
    this.cdr.detectChanges();
  }

  cancelSelectedPhoto(): void {
    this.revokeSelectedPhotoPreview();
    this.selectedPhotoFile = null;
    this.photoModalMode = '';
    this.cdr.detectChanges();
  }

  uploadPhotoFile(file: File): void {
    this.isUploadingPhoto = true;
    this.errorMessage = '';

    const formData = new FormData();
    formData.append('file', file);

    this.http.post<{ profilePhotoUrl: string }>(`${this.apiUrl}/photo`, formData, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showSuccess('Photo de profil modifiée avec succès.');
        this.isUploadingPhoto = false;

        this.revokeSelectedPhotoPreview();
        this.selectedPhotoFile = null;
        this.photoModalMode = '';

        this.loadProfile();
        window.dispatchEvent(new Event('profile-updated'));

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors de l’importation de la photo.'
        );
        this.isUploadingPhoto = false;
        this.cdr.detectChanges();
      }
    });
  }

  deletePhoto(): void {
    if (!this.getProfilePhotoUrl()) {
      this.errorMessage = 'Aucune photo à supprimer.';
      this.cdr.detectChanges();
      return;
    }

    this.isDeletingPhoto = true;
    this.errorMessage = '';

    this.http.delete(`${this.apiUrl}/photo`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: () => {
        this.showSuccess('Photo de profil supprimée avec succès.');
        this.isDeletingPhoto = false;

        this.loadProfile();
        window.dispatchEvent(new Event('profile-updated'));

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = this.getErrorMessage(
          err,
          'Erreur lors de la suppression de la photo.'
        );
        this.isDeletingPhoto = false;
        this.cdr.detectChanges();
      }
    });
  }

  getProfilePhotoUrl(): string {
    if (!this.profile?.profilePhotoUrl) {
      return '';
    }

    if (this.profile.profilePhotoUrl.startsWith('http')) {
      return this.profile.profilePhotoUrl;
    }

    return `${this.baseUrl}${this.profile.profilePhotoUrl}`;
  }

  getInitial(): string {
    return this.profile?.fullName?.charAt(0)?.toUpperCase() || 'U';
  }

  getGenderLabel(gender?: string | null): string {
    if (gender === 'H') {
      return 'Homme';
    }

    if (gender === 'F') {
      return 'Femme';
    }

    return 'Non renseigné';
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return 'Non renseignée';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString('fr-FR');
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('fullName');
    localStorage.removeItem('email');

    this.router.navigate(['/login']);
  }

  private syncProfileForm(profile: ProfileDto): void {
    const nameParts = this.splitFullName(profile.fullName || '');

    this.profileForm = {
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      fullName: profile.fullName || '',
      email: profile.email || '',
      phoneNumber: profile.phoneNumber || '',
      address: profile.address || '',
      gender: profile.gender || '',
      dateOfBirth: this.toDateInputValue(profile.dateOfBirth),
      postalCode: profile.postalCode || '',
      factoryRegistrationNumber: profile.factoryRegistrationNumber || ''
    };
  }

  private splitFullName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return {
        firstName: '',
        lastName: ''
      };
    }

    if (parts.length === 1) {
      return {
        firstName: parts[0],
        lastName: ''
      };
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    };
  }

  private buildFullName(): string {
    const firstName = this.profileForm.firstName.trim();
    const lastName = this.profileForm.lastName.trim();

    return [firstName, lastName].filter(Boolean).join(' ').trim();
  }

  private toDateInputValue(value?: string | null): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 10);
    }

    return date.toISOString().slice(0, 10);
  }

  private revokeSelectedPhotoPreview(): void {
    if (this.selectedPhotoPreviewUrl) {
      URL.revokeObjectURL(this.selectedPhotoPreviewUrl);
      this.selectedPhotoPreviewUrl = '';
    }
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();

    if (!token) {
      return new HttpHeaders();
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
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

  private getErrorMessage(error: any, fallback: string): string {
    if (typeof error?.error === 'string') {
      return error.error;
    }

    if (error?.error?.message) {
      return error.error.message;
    }

    return fallback;
  }
}