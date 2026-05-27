import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-access-request',
  imports: [FormsModule, NgIf, RouterLink],
  templateUrl: './access-request.html',
  styleUrl: './access-request.scss'
})
export class AccessRequestComponent {
  private http = inject(HttpClient);

  private apiUrl = 'http://localhost:5160/api/AccessRequests';

  form = {
    fullName: '',
    matricule: '',
    email: '',
    phoneNumber: '',
    department: '',
    message: ''
  };

  loading = false;
  successMessage = '';
  errorMessage = '';

  submit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.form.fullName.trim()) {
      this.errorMessage = 'Veuillez saisir votre nom complet.';
      return;
    }

    if (!this.form.matricule.trim()) {
      this.errorMessage = 'Veuillez saisir votre matricule TIS.';
      return;
    }

    if (!this.form.email.trim()) {
      this.errorMessage = 'Veuillez saisir votre adresse email.';
      return;
    }

    if (!this.form.phoneNumber.trim()) {
      this.errorMessage = 'Veuillez saisir votre numéro de téléphone.';
      return;
    }

    if (!this.form.department.trim()) {
      this.errorMessage = 'Veuillez saisir votre service ou département.';
      return;
    }

    this.loading = true;

    const payload = {
      fullName: this.form.fullName.trim(),
      matricule: this.form.matricule.trim(),
      email: this.form.email.trim(),
      phoneNumber: this.form.phoneNumber.trim(),
      department: this.form.department.trim(),
      message: this.form.message.trim()
    };

    this.http.post<{ message: string }>(this.apiUrl, payload).subscribe({
      next: (response) => {
        this.loading = false;
        this.successMessage = response.message;
        this.errorMessage = '';

        this.form = {
          fullName: '',
          matricule: '',
          email: '',
          phoneNumber: '',
          department: '',
          message: ''
        };
      },

      error: (err) => {
        console.error(err);

        this.loading = false;
        this.successMessage = '';

        this.errorMessage =
          typeof err?.error === 'string'
            ? err.error
            : err?.error?.message || 'Erreur lors de l’envoi de la demande.';
      }
    });
  }
}