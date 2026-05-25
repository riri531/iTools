import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, NgIf, RouterLink],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss'
})
export class ResetPasswordComponent {
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  userId = 0;
  token = '';

  newPassword = '';
  confirmPassword = '';

  loading = false;
  successMessage = '';
  errorMessage = '';

  ngOnInit(): void {
    const userIdParam = this.route.snapshot.queryParamMap.get('userId');
    const tokenParam = this.route.snapshot.queryParamMap.get('token');

    this.userId = userIdParam ? Number(userIdParam) : 0;
    this.token = tokenParam || '';

    if (!this.userId || !this.token) {
      this.errorMessage = 'Lien de réinitialisation invalide.';
    }
  }

  submit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.userId || !this.token) {
      this.errorMessage = 'Lien de réinitialisation invalide.';
      return;
    }

    if (!this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Veuillez saisir et confirmer le nouveau mot de passe.';
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 6 caractères.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
      return;
    }

    this.loading = true;

    this.authService.resetPassword({
      userId: this.userId,
      token: this.token,
      newPassword: this.newPassword,
      confirmPassword: this.confirmPassword
    }).subscribe({
      next: (response) => {
        this.loading = false;
        this.successMessage = response.message;
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.errorMessage =
          typeof err?.error === 'string'
            ? err.error
            : 'Impossible de réinitialiser le mot de passe.';
      }
    });
  }
}