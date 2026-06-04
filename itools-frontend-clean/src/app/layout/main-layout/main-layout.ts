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
  catchError,
  finalize,
  of,
  takeUntil,
  timeout
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
  roles?: string[];
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

  private destroy$ = new Subject<void>();
  private searchRequestId = 0;

  private apiUrl = 'http://localhost:5160/api/Profile';
  private baseUrl = 'http://localhost:5160';

  searchText = '';
  searchFocused = false;
  searchLoading = false;
  searchHasBeenSubmitted = false;
  searchResults: GlobalSearchResult[] = [];

  userName = localStorage.getItem('fullName') || 'Rania Admin';
  userRole = localStorage.getItem('role') || 'ADMIN';
  profilePhotoUrl = '';

  private allNavItems: NavItem[] = [
    {
      label: 'Dashboard',
      route: '/app/dashboard',
      icon: '/icons/dashboard.png',
      keywords: ['dashboard', 'tableau de bord', 'statistiques', 'accueil', 'home'],
      roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE', 'EMPLOYÉ']
    },
    {
      label: 'Outillages',
      route: '/app/outillages',
      icon: '/icons/outils.png',
      keywords: [
        'outillage',
        'outillages',
        'outil',
        'outils',
        'designation',
        'désignation',
        'designations',
        'désignations',
        'référentiel',
        'referentiel'
      ],
      roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE', 'EMPLOYÉ']
    },
    {
      label: 'Lignes',
      route: '/app/lignes',
      icon: '/icons/lignes.png',
      keywords: ['ligne', 'lignes', 'production'],
      roles: ['ADMIN', 'RESPONSABLE']
    },
    {
      label: 'Clients',
      route: '/app/clients',
      icon: '/icons/clients.png',
      keywords: ['client', 'clients'],
      roles: ['ADMIN', 'RESPONSABLE']
    },
    {
      label: 'Fournisseurs',
      route: '/app/fournisseurs',
      icon: '/icons/fournisseurs.png',
      keywords: ['fournisseur', 'fournisseurs', 'supplier', 'suppliers'],
      roles: ['ADMIN', 'RESPONSABLE']
    },
    {
      label: 'Utilisateurs inscrits',
      route: '/app/users',
      icon: '/icons/utilisateur.png',
      keywords: ['utilisateur', 'utilisateurs', 'users', 'user', 'admin', 'administrateur'],
      roles: ['ADMIN']
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
        'hs',
        'hors service',
        'stockage'
      ],
      roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE', 'EMPLOYÉ']
    },
    {
      label: 'Matières',
      route: '/app/matieres',
      icon: '/icons/matiere.png',
      keywords: ['matiere', 'matières', 'matieres', 'matière', 'zinc', 'plomb', 'pb'],
      roles: ['ADMIN', 'RESPONSABLE']
    },
    {
      label: 'Assistance intelligente',
      route: '/app/assistance',
      icon: '/icons/assistance-intelligente.png',
      keywords: ['assistance', 'intelligente', 'aide', 'guide', 'chatbot', 'support', 'réclamation'],
      roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE', 'EMPLOYÉ']
    },
    {
      label: 'Historique',
      route: '/app/archives',
      icon: '/icons/historique.png',
      keywords: ['historique', 'archive', 'archives', 'traçabilité', 'journal', 'logs'],
      roles: ['ADMIN']
    }
  ];

  private profileUpdatedHandler = () => {
    this.loadTopbarProfile();
  };

  ngOnInit(): void {
    this.loadTopbarProfile();
    window.addEventListener('profile-updated', this.profileUpdatedHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('profile-updated', this.profileUpdatedHandler);

    this.destroy$.next();
    this.destroy$.complete();
  }

  get navItems(): NavItem[] {
    const role = this.userRole.toUpperCase();

    return this.allNavItems.filter(item => {
      if (!item.roles) {
        return true;
      }

      return item.roles.includes(role);
    });
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

    if (role === 'ADMIN') return 'Administrateur';
    if (role === 'RESPONSABLE') return 'Responsable';
    if (role === 'EMPLOYE' || role === 'EMPLOYÉ') return 'Employé';

    return this.userRole;
  }

  get showSearchResults(): boolean {
    return (
      this.searchFocused &&
      this.searchHasBeenSubmitted &&
      this.searchText.trim().length > 0
    );
  }

  getTopbarProfilePhotoUrl(): string {
    if (!this.profilePhotoUrl) return '';
    if (this.profilePhotoUrl.startsWith('http')) return this.profilePhotoUrl;
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
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.searchFocused = false;
    }, 180);
  }

  onSearchInput(): void {
    this.searchHasBeenSubmitted = false;
    this.searchLoading = false;
    this.searchResults = [];
    this.searchRequestId++;
  }

  submitSearch(): void {
    const keyword = this.searchText.trim();

    this.searchFocused = true;
    this.searchHasBeenSubmitted = true;

    if (!keyword) {
      this.clearSearchResults();
      return;
    }

    const currentRequestId = ++this.searchRequestId;

    this.searchResults = [];
    this.searchLoading = true;

    this.globalSearchService.search(keyword)
      .pipe(
        timeout(6000),
        catchError(error => {
          console.error('Erreur recherche globale :', error);
          return of([] as GlobalSearchResult[]);
        }),
        finalize(() => {
          if (currentRequestId === this.searchRequestId) {
            this.searchLoading = false;
          }
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: backendResults => {
          if (currentRequestId !== this.searchRequestId) {
            return;
          }

          const pageResults = this.getPageResults(keyword);
          const mergedResults = this.mergeSearchResults(backendResults, pageResults);
          this.searchResults = mergedResults;

          const bestResult = this.getBestSearchResult(keyword, mergedResults);

          if (bestResult) {
            this.goToResult(bestResult);
            return;
          }

          this.searchLoading = false;
        },
        error: error => {
          console.error('Erreur inattendue recherche globale :', error);

          if (currentRequestId === this.searchRequestId) {
            this.searchResults = this.getPageResults(keyword);
            this.searchLoading = false;

            const bestPageResult = this.getBestSearchResult(keyword, this.searchResults);

            if (bestPageResult) {
              this.goToResult(bestPageResult);
            }
          }
        }
      });
  }

  goToResult(result: GlobalSearchResult): void {
    if (!result?.route) {
      this.searchLoading = false;
      return;
    }

    this.searchText = '';
    this.searchFocused = false;
    this.searchHasBeenSubmitted = false;
    this.searchResults = [];
    this.searchLoading = false;
    this.searchRequestId++;

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
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private clearSearchResults(): void {
    this.searchResults = [];
    this.searchLoading = false;
    this.searchHasBeenSubmitted = false;
    this.searchRequestId++;
  }

  private mergeSearchResults(
    primaryResults: GlobalSearchResult[],
    secondaryResults: GlobalSearchResult[]
  ): GlobalSearchResult[] {
    const merged = [...primaryResults, ...secondaryResults];
    const seen = new Set<string>();

    return merged.filter(result => {
      const key = `${result.route || ''}|${result.label || ''}|${result.type || ''}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private getBestSearchResult(
    keyword: string,
    results: GlobalSearchResult[]
  ): GlobalSearchResult | null {
    if (!results.length) {
      return null;
    }

    const q = this.normalizeText(keyword);

    const exactResult = results.find(result =>
      this.normalizeText(result.label || '') === q
    );

    if (exactResult) {
      return exactResult;
    }

    const startsWithResult = results.find(result =>
      this.normalizeText(result.label || '').startsWith(q)
    );

    if (startsWithResult) {
      return startsWithResult;
    }

    return results[0];
  }

  private getPageResults(keyword: string): GlobalSearchResult[] {
    const q = this.normalizeText(keyword);

    if (!q) return [];

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

    if (!token) return new HttpHeaders();

    return new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
  }
}
