import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule, NgIf, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  rememberMe = false;

  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    const savedEmail = localStorage.getItem('rememberedEmail');

    if (savedEmail) {
      this.email = savedEmail;
      this.rememberMe = true;
    }
  }

  submit(): void {
    this.errorMessage = '';

    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage = 'Veuillez saisir votre email et votre mot de passe.';
      return;
    }

    this.loading = true;

    this.authService.login({
      email: this.email.trim(),
      password: this.password,
      rememberMe: this.rememberMe
    }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/home']);
      },

      error: (err) => {
        console.error(err);

        this.loading = false;
        this.errorMessage =
          typeof err?.error === 'string'
            ? err.error
            : 'Email ou mot de passe invalide.';
      }
    });
  }
}