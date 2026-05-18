import { Component, inject } from '@angular/core';
import { NgFor } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [NgFor, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomeComponent {
  private router = inject(Router);

  sidebarOpen = false;
  currentYear = new Date().getFullYear();

  menuItems = [
    { label: 'Accueil', route: '/home', icon: '🏠' },
    { label: 'Dashboard', route: '/app/dashboard', icon: '📊' },
    { label: 'Profil', route: '/app/profile', icon: '👤' },
    { label: 'Réclamations', route: '/app/reclamations', icon: '✉️' },
    { label: 'Utilisateurs', route: '/app/users', icon: '👥' },
    { label: 'Désignations', route: '/app/designations', icon: '🏷️' },
    { label: 'Lignes', route: '/app/lignes', icon: '📌' },
    { label: 'Clients', route: '/app/clients', icon: '🤝' },
    { label: 'Fournisseurs', route: '/app/fournisseurs', icon: '🏭' },
    { label: 'Matières', route: '/app/matieres', icon: '⚙️' },
    { label: 'Emplacements', route: '/app/emplacements', icon: '📍' },
    { label: 'Outillages', route: '/app/outils', icon: '🧰' },
    { label: 'Archives', route: '/app/archives', icon: '🗂️' }
  ];

  strengths = [
    {
      title: 'Organisation des outillages',
      description: 'Centraliser les outils et faciliter leur suivi dans l’usine.'
    },
    {
      title: 'Gestion des emplacements',
      description: 'Visualiser les emplacements libres, occupés ou hors service.'
    },
    {
      title: 'Accès par rôle',
      description: 'Séparer les droits entre administrateur, responsable et employé.'
    },
    {
      title: 'Traçabilité',
      description: 'Suivre les opérations importantes réalisées sur les outils.'
    }
  ];

  modules = [
    'Utilisateurs',
    'Rôles',
    'Désignations',
    'Lignes',
    'Clients',
    'Fournisseurs',
    'Matières',
    'Emplacements',
    'Outillages',
    'Dashboard',
    'Réclamations',
    'Archives'
  ];

  openSidebar(): void {
    this.sidebarOpen = true;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('fullName');
    localStorage.removeItem('email');

    this.router.navigate(['/login']);
  }
}