import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  takeUntil,
  of
} from 'rxjs';
import {
  GlobalSearchResult,
  GlobalSearchService
} from '../../core/services/global-search';
import { AuthService } from '../../core/services/auth';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  keywords: string[];
}

interface ProfileDto {
  id: number;
  fullName: string;
  email: string;
  role: string;
  phoneNumber: string | null;
  address: string | null;
  profilePhotoUrl: string | null;
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    FormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss'
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private globalSearchService = inject(GlobalSearchService);

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  private apiUrl = 'http://localhost:5160/api/Profile';
  private baseUrl = 'http://localhost:5160';

  searchText = '';
  searchFocused = false;
  searchLoading = false;
  searchResults: GlobalSearchResult[] = [];

  userName = localStorage.getItem('fullName') || 'Rania Admin';
  userRole = localStorage.getItem('role') || 'ADMIN';
  profilePhotoUrl = '';

  navItems: NavItem[] = [
    {
      label: 'Dashboard',
      route: '/app/dashboard',
      icon: '/icons/dashboard.png',
      keywords: [
        'dashboard',
        'tableau de bord',
        'statistiques',
        'accueil',
        'home'
      ]
    },
    {
      label: 'Désignations',
      route: '/app/designations',
      icon: '/icons/designation.png',
      keywords: [
        'designation',
        'désignation',
        'designations',
        'désignations',
        'référentiel',
        'referentiel'
      ]
    },
    {
      label: 'Lignes',
      route: '/app/lignes',
      icon: '/icons/lignes.png',
      keywords: [
        'ligne',
        'lignes',
        'production'
      ]
    },
    {
      label: 'Clients',
      route: '/app/clients',
      icon: '/icons/clients.png',
      keywords: [
        'client',
        'clients'
      ]
    },
    {
      label: 'Fournisseurs',
      route: '/app/fournisseurs',
      icon: '/icons/fournisseurs.png',
      keywords: [
        'fournisseur',
        'fournisseurs',
        'supplier',
        'suppliers'
      ]
    },
    {
      label: 'Utilisateurs inscrits',
      route: '/app/users',
      icon: '/icons/utilisateur.png',
      keywords: [
        'utilisateur',
        'utilisateurs',
        'users',
        'user',
        'admin',
        'administrateur',
        'responsable',
        'employé',
        'employe'
      ]
    },
    {
      label: 'Emplacements',
      route: '/app/emplacements',
      icon: '/icons/emplacement.png',
      keywords: [
        'emplacement',
        'emplacements',
        'libre',
        'libres',
        'occupé',
        'occupe',
        'occupés',
        'occupes',
        'hs',
        'hors service',
        'stockage'
      ]
    },
    {
      label: 'Matières',
      route: '/app/matieres',
      icon: '/icons/matiere.png',
      keywords: [
        'matiere',
        'matières',
        'matieres',
        'matière',
        'matières premières',
        'matieres premieres',
        'zinc',
        'plomb',
        'pb',
        'zi',
        'matiere premiere'
      ]
    },
    {
      label: 'Outils',
      route: '/app/outils',
      icon: '/icons/outils.png',
      keywords: [
        'outil',
        'outils',
        'outillage',
        'outillages',
        'tool',
        'tools'
      ]
    },
    {
      label: 'Assistance intelligente',
      route: '/app/assistance',
      icon: '/icons/assistance-intelligente.png',
      keywords: [
        'assistance',
        'intelligente',
        'aide',
        'guide',
        'chatbot',
        'support',
        'réclamation',
        'reclamation',
        'reclamations',
        'réclamations',
        'message',
        'messages'
      ]
    },
    {
      label: 'Historique',
      route: '/app/archives',
      icon: '/icons/historique.png',
      keywords: [
        'historique',
        'archive',
        'archives',
        'traçabilité',
        'tracabilite',
        'journal',
        'logs'
      ]
    }
  ];

  private profileUpdatedHandler = () => {
    this.loadTopbarProfile();
  };

  constructor() {
    this.searchSubject
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(value => {
          const keyword = value.trim();

          if (!keyword) {
            this.searchLoading = false;
            return of([]);
          }

          this.searchLoading = true;
          return this.globalSearchService.search(keyword);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: backendResults => {
          const pageResults = this.getPageResults(this.searchText);
          this.searchResults = [...pageResults, ...backendResults];
          this.searchLoading = false;
        },
        error: error => {
          console.error(error);
          this.searchResults = this.getPageResults(this.searchText);
          this.searchLoading = false;
        }
      });
  }

  ngOnInit(): void {
    this.loadTopbarProfile();
    window.addEventListener('profile-updated', this.profileUpdatedHandler);
  }

  get initials(): string {
    return this.userName
      .split(' ')
      .filter(part => part.trim().length > 0)
      .map(part => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  get roleLabel(): string {
    const role = this.userRole.toUpperCase();

    if (role === 'ADMIN') {
      return 'Administrateur';
    }

    if (role === 'RESPONSABLE') {
      return 'Responsable';
    }

    if (role === 'EMPLOYE' || role === 'EMPLOYÉ') {
      return 'Employé';
    }

    return this.userRole;
  }

  get showSearchResults(): boolean {
    return this.searchFocused && this.searchText.trim().length > 0;
  }

  getTopbarProfilePhotoUrl(): string {
    if (!this.profilePhotoUrl) {
      return '';
    }

    if (this.profilePhotoUrl.startsWith('http')) {
      return this.profilePhotoUrl;
    }

    return `${this.baseUrl}${this.profilePhotoUrl}`;
  }

  loadTopbarProfile(): void {
    this.http.get<ProfileDto>(`${this.apiUrl}/me`, {
      headers: this.getAuthHeaders()
    }).subscribe({
      next: profile => {
        this.userName = profile.fullName || this.userName;
        this.userRole = profile.role || this.userRole;
        this.profilePhotoUrl = profile.profilePhotoUrl || '';

        localStorage.setItem('fullName', this.userName);
        localStorage.setItem('email', profile.email || '');
        localStorage.setItem('role', this.userRole);
      },
      error: error => {
        console.error('Erreur lors du chargement du profil topbar :', error);
        this.profilePhotoUrl = '';
      }
    });
  }

  onSearchFocus(): void {
    this.searchFocused = true;

    if (this.searchText.trim()) {
      this.searchSubject.next(this.searchText);
    }
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.searchFocused = false;
    }, 180);
  }

  onSearchChange(): void {
    const keyword = this.searchText.trim();

    if (!keyword) {
      this.searchResults = [];
      this.searchLoading = false;
      return;
    }

    this.searchLoading = true;
    this.searchSubject.next(keyword);
  }

  submitSearch(): void {
    const firstResult = this.searchResults[0];

    if (firstResult) {
      this.goToResult(firstResult);
      return;
    }

    const keyword = this.searchText.trim();

    if (keyword) {
      this.router.navigate(['/app/dashboard'], {
        queryParams: { q: keyword }
      });
    }
  }

  goToResult(result: GlobalSearchResult): void {
    this.searchText = '';
    this.searchFocused = false;
    this.searchResults = [];
    this.searchLoading = false;

    this.router.navigateByUrl(result.route);
  }

  goToProfile(): void {
    this.router.navigate(['/app/profile']);
  }

  goToNotifications(): void {
    this.router.navigate(['/app/notifications']);
  }

  goToReclamations(): void {
    this.router.navigate(['/app/reclamations']);
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('fullName');
    localStorage.removeItem('email');

    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    window.removeEventListener('profile-updated', this.profileUpdatedHandler);

    this.destroy$.next();
    this.destroy$.complete();
  }

  private getPageResults(keyword: string): GlobalSearchResult[] {
    const q = this.normalizeText(keyword);

    if (!q) {
      return [];
    }

    return this.navItems
      .filter(item => {
        const searchableText = this.normalizeText([
          item.label,
          item.route,
          ...item.keywords
        ].join(' '));

        return searchableText.includes(q);
      })
      .map(item => ({
        type: 'Page',
        label: item.label,
        description: 'Accéder à la page',
        route: item.route,
        icon: item.icon
      }));
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
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
}