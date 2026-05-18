import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NgIf } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../core/services/auth';

interface SidebarProfileDto {
  id: number;
  fullName: string;
  email: string;
  role: string;
  phoneNumber: string | null;
  address: string | null;
  profilePhotoUrl: string | null;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, NgIf],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);

  private profileApiUrl = 'http://localhost:5160/api/Profile/me';
  private baseUrl = 'http://localhost:5160';

  profilePhotoUrl = '';

  private profileUpdateHandler = () => {
    this.loadSidebarProfile();
  };

  ngOnInit(): void {
    this.loadSidebarProfile();
    window.addEventListener('profile-updated', this.profileUpdateHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('profile-updated', this.profileUpdateHandler);
  }

  get fullName(): string {
    return this.authService.getFullName() || 'Utilisateur';
  }

  get email(): string {
    return this.authService.getEmail() || '';
  }

  get role(): string {
    return this.authService.getRole() || '';
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  get isResponsable(): boolean {
    return this.authService.isResponsable();
  }

  get isEmploye(): boolean {
    return this.authService.isEmploye();
  }

  get canSeeUsers(): boolean {
    return this.isAdmin;
  }

  get canSeeAssistance(): boolean {
    return this.isAdmin || this.isResponsable || this.isEmploye;
  }

  get canSeeDesignations(): boolean {
    return this.isAdmin || this.isResponsable || this.isEmploye;
  }

  get canSeeLignes(): boolean {
    return this.isAdmin || this.isResponsable || this.isEmploye;
  }

  get canSeeClients(): boolean {
    return this.isAdmin || this.isResponsable;
  }

  get canSeeFournisseurs(): boolean {
    return this.isAdmin || this.isResponsable;
  }

  get canSeeMatieres(): boolean {
    return this.isAdmin || this.isResponsable || this.isEmploye;
  }

  get canSeeEmplacements(): boolean {
    return this.isAdmin || this.isResponsable || this.isEmploye;
  }

  get canSeeOutils(): boolean {
    return this.isAdmin || this.isResponsable || this.isEmploye;
  }

  getInitial(): string {
    return this.fullName.charAt(0).toUpperCase() || 'U';
  }

  getSidebarPhotoUrl(): string {
    if (!this.profilePhotoUrl) {
      return '';
    }

    if (this.profilePhotoUrl.startsWith('http')) {
      return this.profilePhotoUrl;
    }

    return `${this.baseUrl}${this.profilePhotoUrl}`;
  }

  loadSidebarProfile(): void {
    const token = this.authService.getToken();

    if (!token) {
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    this.http.get<SidebarProfileDto>(this.profileApiUrl, { headers }).subscribe({
      next: (profile) => {
        this.profilePhotoUrl = profile.profilePhotoUrl || '';

        if (profile.fullName && profile.email) {
          this.authService.updateCurrentUser(profile.fullName, profile.email);
        }
      },
      error: (err) => {
        console.error('Erreur chargement profil sidebar :', err);
      }
    });
  }

  goToProfile(): void {
    this.router.navigate(['/app/profile']);
  }

  logout(): void {
    this.authService.logout();
    window.location.href = '/login';
  }
}