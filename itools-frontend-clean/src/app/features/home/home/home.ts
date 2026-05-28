import { Component } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [NgFor, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomeComponent {
  currentYear = new Date().getFullYear();

  features = [
    {
      icon: '/images/home/centraliser.png',
      title: 'Centraliser',
      text: 'Toutes les données utiles dans un espace clair.'
    },
    {
      icon: '/images/home/localiser.png',
      title: 'Localiser',
      text: 'Des emplacements visibles en quelques secondes.'
    },
    {
      icon: '/images/home/signaler.png',
      title: 'Signaler',
      text: 'Des réclamations simples à suivre.'
    },
    {
      icon: '/images/home/tracabilite.png',
      title: 'Tracer',
      text: 'Un historique fiable des opérations.'
    }
  ];

  rules = [
    {
      id: '01',
      title: 'Statut des emplacements',
      text: 'Un emplacement peut être libre, occupé ou hors service selon sa disponibilité réelle.'
    },
    {
      id: '02',
      title: 'Affectation des outils',
      text: 'Un outil actif doit être affecté à un emplacement disponible pour garantir un suivi cohérent.'
    },
    {
      id: '03',
      title: 'Libération',
      text: 'Lorsqu’un outil est retiré ou déplacé, son emplacement peut redevenir disponible.'
    },
    {
      id: '04',
      title: 'Référentiels métier',
      text: 'Les désignations, lignes, clients, fournisseurs et matières structurent les données.'
    },
    {
      id: '05',
      title: 'Accès par rôle',
      text: 'Les droits sont adaptés selon le profil : administrateur, responsable ou employé.'
    },
    {
      id: '06',
      title: 'Historique',
      text: 'Les opérations importantes sont historisées pour assurer un meilleur contrôle.'
    }
  ];

  modules = [
    'Dashboard',
    'Outillages',
    'Emplacements',
    'Désignations',
    'Lignes',
    'Clients',
    'Fournisseurs',
    'Matières',
    'Utilisateurs',
    'Réclamations',
    'Notifications',
    'Archives'
  ];
}