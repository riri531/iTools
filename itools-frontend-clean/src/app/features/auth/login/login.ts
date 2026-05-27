import {
  AfterViewInit,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

declare global {
  interface Window {
    grecaptcha: any;
  }
}

@Component({
  selector: 'app-login',
  imports: [FormsModule, NgIf, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent implements OnInit, AfterViewInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  @ViewChild('recaptchaContainer')
  recaptchaContainer?: ElementRef<HTMLDivElement>;

  email = '';
  password = '';
  rememberMe = false;

  loading = false;
  errorMessage = '';

  private recaptchaWidgetId: number | null = null;

  private readonly recaptchaSiteKey = '6LdxR_4sAAAAAMkMqY6GyF81MSVcVwb7fEgcpHKT';

  ngOnInit(): void {
    const savedEmail = localStorage.getItem('rememberedEmail');

    if (savedEmail) {
      this.email = savedEmail;
      this.rememberMe = true;
    }
  }

  ngAfterViewInit(): void {
    this.loadRecaptchaScript()
      .then(() => this.renderRecaptcha())
      .catch(() => {
        this.errorMessage = 'Impossible de charger le reCAPTCHA.';
      });
  }

  submit(): void {
    this.errorMessage = '';

    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage = 'Veuillez saisir votre email et votre mot de passe.';
      return;
    }

    const recaptchaToken = this.getRecaptchaToken();

    if (!recaptchaToken) {
      this.errorMessage = 'Veuillez valider le reCAPTCHA.';
      return;
    }

    this.loading = true;

    this.authService.login({
      email: this.email.trim(),
      password: this.password,
      rememberMe: this.rememberMe,
      recaptchaToken: recaptchaToken
    }).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/home']);
      },

      error: (err) => {
        console.error(err);

        this.loading = false;
        this.resetRecaptcha();

        this.errorMessage =
          typeof err?.error === 'string'
            ? err.error
            : 'Email ou mot de passe invalide.';
      }
    });
  }

  private loadRecaptchaScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.grecaptcha) {
        resolve();
        return;
      }

      const existingScript = document.getElementById('google-recaptcha-script');

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject());
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-recaptcha-script';
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      script.async = true;
      script.defer = true;

      script.onload = () => resolve();
      script.onerror = () => reject();

      document.body.appendChild(script);
    });
  }

  private renderRecaptcha(): void {
    if (!this.recaptchaContainer) {
      return;
    }

    if (!window.grecaptcha || !window.grecaptcha.render) {
      setTimeout(() => this.renderRecaptcha(), 300);
      return;
    }

    if (this.recaptchaWidgetId !== null) {
      return;
    }

    this.recaptchaWidgetId = window.grecaptcha.render(
      this.recaptchaContainer.nativeElement,
      {
        sitekey: this.recaptchaSiteKey
      }
    );
  }

  private getRecaptchaToken(): string {
    if (this.recaptchaWidgetId === null || !window.grecaptcha) {
      return '';
    }

    return window.grecaptcha.getResponse(this.recaptchaWidgetId);
  }

  private resetRecaptcha(): void {
    if (this.recaptchaWidgetId !== null && window.grecaptcha) {
      window.grecaptcha.reset(this.recaptchaWidgetId);
    }
  }
}