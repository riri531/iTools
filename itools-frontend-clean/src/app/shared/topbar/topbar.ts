import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-topbar',
  imports: [],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss'
})
export class TopbarComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  get fullName(): string {
    return this.authService.getFullName() ?? 'Utilisateur';
  }

  get role(): string {
    return this.authService.getRole() ?? '';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}