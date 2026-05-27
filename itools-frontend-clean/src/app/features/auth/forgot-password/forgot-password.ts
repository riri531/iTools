import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, NgIf, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss'
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);

  email = '';
  loading = false;
  successMessage = '';
  errorMessage = '';

  submit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.email.trim()) {
      this.errorMessage = 'Veuillez saisir votre adresse email.';
      return;
    }

    this.loading = true;

    this.authService.forgotPassword({
      email: this.email.trim()
    }).subscribe({
      next: (response) => {
        this.loading = false;
        this.successMessage = response.message;
        this.email = '';
      },

      error: (err) => {
        console.error(err);

        this.loading = false;
        this.errorMessage =
          typeof err?.error === 'string'
            ? err.error
            : 'Une erreur est survenue lors de la demande.';
      }
    });
  }
}