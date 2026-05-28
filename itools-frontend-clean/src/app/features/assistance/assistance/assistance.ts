import { Component, OnInit, inject } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth';

interface HelpQuestion {
  id: string;
  label: string;
  answer: string;
  steps?: string[];
  relatedRoute?: string;
  relatedRouteLabel?: string;
}

interface HelpTopic {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  badge: string;
  route?: string;
  questions: HelpQuestion[];
}

interface ChatMessage {
  id: string;
  from: 'bot' | 'user';
  text: string;
  type?: 'text' | 'topic-selection' | 'question-selection' | 'answer';
  topicId?: string;
  question?: HelpQuestion;
  createdAt: string;
}

interface AssistanceConversation {
  id: string;
  title: string;
  selectedTopicId: string | null;
  selectedQuestionId: string | null;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-assistance',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, FormsModule],
  templateUrl: './assistance.html',
  styleUrl: './assistance.scss'
})
export class AssistanceComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);

  searchText = '';

  selectedTopic: HelpTopic | null = null;
  selectedQuestion: HelpQuestion | null = null;

  conversations: AssistanceConversation[] = [];
  currentConversation: AssistanceConversation | null = null;

  topics: HelpTopic[] = [
    {
      id: 'dashboard',
      title: 'Comprendre le Dashboard',
      shortTitle: 'Dashboard',
      description: 'Statistiques, cartes, graphiques et vision globale de l’état des outillages.',
      badge: 'DB',
      route: '/app/dashboard',
      questions: [
        {
          id: 'dashboard-role',
          label: 'À quoi sert le Dashboard ?',
          answer: 'Le Dashboard donne une vue rapide de l’état global de l’application iTools : emplacements libres, outillages, emplacements hors service et utilisateurs inscrits.',
          steps: [
            'Consulte les cartes statistiques en haut.',
            'Regarde le nombre d’emplacements libres.',
            'Vérifie les emplacements HS.',
            'Analyse les graphiques pour comprendre la répartition.',
            'Va vers les pages détaillées si une donnée doit être vérifiée.'
          ],
          relatedRoute: '/app/dashboard',
          relatedRouteLabel: 'Aller vers Dashboard'
        },
        {
          id: 'dashboard-free-location',
          label: 'Comment savoir combien d’emplacements sont libres ?',
          answer: 'Le nombre d’emplacements libres est affiché dans la carte verte du Dashboard. Il indique les emplacements disponibles pour recevoir un outil.',
          steps: [
            'Ouvre la page Dashboard.',
            'Regarde la carte Emplacements libres.',
            'Pour voir le détail, ouvre la page Emplacements.',
            'Filtre les emplacements par statut Libre.'
          ],
          relatedRoute: '/app/emplacements',
          relatedRouteLabel: 'Voir les emplacements'
        },
        {
          id: 'dashboard-hs',
          label: 'Comment repérer les emplacements hors service ?',
          answer: 'Les emplacements HS sont visibles dans la carte rouge du Dashboard et dans le graphique Libre / Occupé / HS.',
          steps: [
            'Consulte la carte Emplacements HS.',
            'Regarde la partie HS du graphique circulaire.',
            'Va dans Emplacements.',
            'Filtre par statut HS.',
            'Passe une réclamation si une intervention est nécessaire.'
          ],
          relatedRoute: '/app/emplacements',
          relatedRouteLabel: 'Filtrer les HS'
        },
        {
          id: 'dashboard-charts',
          label: 'Comment lire les graphiques du Dashboard ?',
          answer: 'Le graphique en bâtons montre les réservations ou affectations par outil ou désignation. Le graphique circulaire montre la répartition des emplacements entre Libre, Occupé et HS.',
          steps: [
            'Lis d’abord les cartes statistiques.',
            'Compare les barres pour voir les désignations les plus utilisées.',
            'Analyse le graphique circulaire.',
            'Ouvre Outillages ou Emplacements pour consulter le détail.'
          ],
          relatedRoute: '/app/dashboard',
          relatedRouteLabel: 'Voir le Dashboard'
        }
      ]
    },
    {
      id: 'outillages',
      title: 'Comprendre la page Outillages',
      shortTitle: 'Outillages',
      description: 'Désignations, outils associés, fiches PDF, import, export et réclamations.',
      badge: 'OT',
      route: '/app/outillages',
      questions: [
        {
          id: 'outillages-role',
          label: 'À quoi sert la page Outillages ?',
          answer: 'La page Outillages regroupe les désignations et permet d’accéder aux outils associés à chaque désignation. Elle évite de séparer les désignations et les outils dans deux pages différentes.',
          steps: [
            'Ouvre la page Outillages.',
            'Consulte les désignations disponibles.',
            'Utilise la recherche ou les filtres.',
            'Clique sur le bouton dossier pour consulter les outils liés à une désignation.'
          ],
          relatedRoute: '/app/outillages',
          relatedRouteLabel: 'Aller vers Outillages'
        },
        {
          id: 'outillages-designation-definition',
          label: 'C’est quoi une désignation ?',
          answer: 'Une désignation représente une catégorie ou un type d’outillage. Elle sert à organiser les outils et à les retrouver plus rapidement.',
          steps: [
            'Ouvre Outillages.',
            'Regarde les cartes affichées.',
            'Chaque carte correspond à une désignation.',
            'Clique sur le bouton dossier pour voir les outils associés.'
          ],
          relatedRoute: '/app/outillages',
          relatedRouteLabel: 'Voir les désignations'
        },
        {
          id: 'outillages-buttons',
          label: 'Que signifient les boutons sous une désignation ?',
          answer: 'Le bouton jaune sert à modifier, le bouton gris à consulter les outils, le bouton bleu à télécharger la fiche PDF, le bouton vert à passer une réclamation et le bouton rouge à supprimer.',
          steps: [
            'Jaune avec stylo : modifier.',
            'Gris avec dossier : consulter les outils.',
            'Bleu avec document : télécharger la fiche PDF.',
            'Vert avec point d’exclamation : passer une réclamation.',
            'Rouge avec poubelle : supprimer.'
          ],
          relatedRoute: '/app/outillages',
          relatedRouteLabel: 'Voir les boutons'
        },
        {
          id: 'outillages-import',
          label: 'Comment importer plusieurs désignations ?',
          answer: 'L’import en masse permet d’ajouter plusieurs désignations à partir d’un fichier Excel ou CSV basé sur un modèle.',
          steps: [
            'Clique sur Modèle Excel.',
            'Remplis le fichier sans changer les colonnes.',
            'Clique sur Import.',
            'Sélectionne ton fichier.',
            'Valide l’import.'
          ],
          relatedRoute: '/app/outillages',
          relatedRouteLabel: 'Importer des désignations'
        }
      ]
    },
    {
      id: 'outils-designation',
      title: 'Outils d’une désignation',
      shortTitle: 'Outils liés',
      description: 'Liste des outils rattachés à une désignation, affectation, statut et emplacement.',
      badge: 'OD',
      route: '/app/outillages',
      questions: [
        {
          id: 'outil-definition',
          label: 'C’est quoi un outil dans iTools ?',
          answer: 'Un outil représente un outillage réel utilisé dans l’usine. Il peut être lié à une ligne, un client, un fournisseur, une matière, une désignation et un emplacement.',
          steps: [
            'Ouvre Outillages.',
            'Choisis une désignation.',
            'Clique sur consulter les outils.',
            'Consulte les informations de chaque outil.'
          ],
          relatedRoute: '/app/outillages',
          relatedRouteLabel: 'Ouvrir Outillages'
        },
        {
          id: 'outil-linked-designation',
          label: 'Pourquoi les outils sont affichés par désignation ?',
          answer: 'Les outils sont affichés par désignation pour mieux organiser la consultation et éviter un désordre entre toutes les références.',
          steps: [
            'Va dans Outillages.',
            'Sélectionne une désignation.',
            'Ouvre les outils liés.',
            'La liste affichera uniquement les outils de cette désignation.'
          ],
          relatedRoute: '/app/outillages',
          relatedRouteLabel: 'Consulter par désignation'
        },
        {
          id: 'outil-status',
          label: 'Que signifie le statut S ou HS d’un outil ?',
          answer: 'Le statut S signifie que l’outil est en service. Le statut HS signifie que l’outil est hors service et ne doit pas être utilisé.',
          steps: [
            'Consulte la colonne Statut.',
            'S signifie en service.',
            'HS signifie hors service.',
            'Si l’outil est HS, vérifie la justification.',
            'Passe une réclamation si nécessaire.'
          ],
          relatedRoute: '/app/outillages',
          relatedRouteLabel: 'Voir les outils'
        }
      ]
    },
    {
      id: 'emplacements',
      title: 'Comprendre les emplacements',
      shortTitle: 'Emplacements',
      description: 'Armoire, numéro, matière, désignation, statut Libre, Occupé ou HS.',
      badge: 'EM',
      route: '/app/emplacements',
      questions: [
        {
          id: 'emplacement-definition',
          label: 'C’est quoi un emplacement ?',
          answer: 'Un emplacement représente un endroit physique ou logique où un outil peut être rangé, réservé ou déclaré hors service.',
          steps: [
            'Ouvre Emplacements.',
            'Consulte la matière.',
            'Vérifie l’armoire et le numéro.',
            'Regarde la désignation associée.',
            'Vérifie le statut.'
          ],
          relatedRoute: '/app/emplacements',
          relatedRouteLabel: 'Aller vers Emplacements'
        },
        {
          id: 'emplacement-status',
          label: 'Que signifient Libre, Occupé et HS ?',
          answer: 'Libre signifie disponible. Occupé signifie qu’un outil est affecté. HS signifie que l’emplacement est hors service.',
          steps: [
            'Ouvre Emplacements.',
            'Regarde la colonne Statut.',
            'Filtre par Libre, Occupé ou HS.',
            'Vérifie les emplacements HS en priorité.'
          ],
          relatedRoute: '/app/emplacements',
          relatedRouteLabel: 'Filtrer par statut'
        },
        {
          id: 'emplacement-reclamation',
          label: 'Quand passer une réclamation sur un emplacement ?',
          answer: 'Il faut passer une réclamation lorsqu’un emplacement est incorrect, indisponible, HS ou incohérent avec l’outil affecté.',
          steps: [
            'Repère l’emplacement concerné.',
            'Clique sur le bouton vert réclamation.',
            'Choisis le type de problème.',
            'Décris l’anomalie.',
            'Envoie la réclamation.'
          ],
          relatedRoute: '/app/emplacements',
          relatedRouteLabel: 'Créer réclamation'
        }
      ]
    },
    {
      id: 'matieres',
      title: 'Comprendre les matières',
      shortTitle: 'Matières',
      description: 'Matières utilisées dans les emplacements et les outillages, process Pb et ROHS.',
      badge: 'MT',
      route: '/app/matieres',
      questions: [
        {
          id: 'matiere-definition',
          label: 'C’est quoi une matière ?',
          answer: 'Une matière représente un matériau utilisé dans les emplacements ou dans la gestion des outillages.',
          steps: [
            'Ouvre Matières.',
            'Consulte le nom de la matière.',
            'Regarde le process associé.',
            'Utilise la recherche ou le filtre process.'
          ],
          relatedRoute: '/app/matieres',
          relatedRouteLabel: 'Aller vers Matières'
        },
        {
          id: 'matiere-process',
          label: 'Que signifient Pb et ROHS ?',
          answer: 'Pb fait référence au plomb. ROHS désigne une conformité liée à la restriction de substances dangereuses.',
          steps: [
            'Ouvre Matières.',
            'Regarde la colonne Process.',
            'Filtre par Pb ou ROHS.',
            'Vérifie la matière concernée.'
          ],
          relatedRoute: '/app/matieres',
          relatedRouteLabel: 'Filtrer matières'
        }
      ]
    },
    {
      id: 'lignes',
      title: 'Comprendre les lignes',
      shortTitle: 'Lignes',
      description: 'Lignes de production utilisées pour rattacher et organiser les outils.',
      badge: 'LG',
      route: '/app/lignes',
      questions: [
        {
          id: 'ligne-definition',
          label: 'C’est quoi une ligne ?',
          answer: 'Une ligne représente une ligne de production ou une zone utilisée dans l’organisation des outils.',
          steps: [
            'Va dans Lignes.',
            'Consulte les lignes disponibles.',
            'Utilise la recherche pour trouver une ligne.',
            'Ajoute ou modifie une ligne si ton rôle le permet.'
          ],
          relatedRoute: '/app/lignes',
          relatedRouteLabel: 'Aller vers Lignes'
        },
        {
          id: 'ligne-tool-link',
          label: 'Pourquoi une ligne est liée à un outil ?',
          answer: 'La ligne permet de savoir à quelle zone de production l’outil est associé.',
          steps: [
            'Ouvre Outillages.',
            'Consulte les outils d’une désignation.',
            'Regarde la colonne Ligne.',
            'Corrige l’affectation si nécessaire.'
          ],
          relatedRoute: '/app/outillages',
          relatedRouteLabel: 'Voir les outils'
        }
      ]
    },
    {
      id: 'clients',
      title: 'Comprendre les clients',
      shortTitle: 'Clients',
      description: 'Clients, familles, références et relation avec les outils.',
      badge: 'CL',
      route: '/app/clients',
      questions: [
        {
          id: 'client-definition',
          label: 'À quoi sert la page Clients ?',
          answer: 'La page Clients permet de gérer les clients, leurs familles et leurs références liées aux outillages.',
          steps: [
            'Va dans Clients.',
            'Consulte le nom client.',
            'Vérifie la famille.',
            'Vérifie la référence.',
            'Utilise ces informations dans la gestion des outils.'
          ],
          relatedRoute: '/app/clients',
          relatedRouteLabel: 'Aller vers Clients'
        },
        {
          id: 'client-tool-link',
          label: 'Pourquoi un outil est lié à un client ?',
          answer: 'L’association outil-client permet de savoir pour quel client ou référence l’outillage est utilisé.',
          steps: [
            'Ouvre Outillages.',
            'Consulte les outils.',
            'Regarde la colonne Client.',
            'Filtre si nécessaire.'
          ],
          relatedRoute: '/app/outillages',
          relatedRouteLabel: 'Voir les outils'
        }
      ]
    },
    {
      id: 'fournisseurs',
      title: 'Comprendre les fournisseurs',
      shortTitle: 'Fournisseurs',
      description: 'Code fournisseur, nom fournisseur, nomenclature et relation avec les outils.',
      badge: 'FR',
      route: '/app/fournisseurs',
      questions: [
        {
          id: 'fournisseur-definition',
          label: 'À quoi sert la page Fournisseurs ?',
          answer: 'La page Fournisseurs permet de gérer les fournisseurs liés aux outillages et à leur approvisionnement.',
          steps: [
            'Va dans Fournisseurs.',
            'Consulte le code fournisseur.',
            'Consulte le nom fournisseur.',
            'Vérifie la nomenclature si elle existe.'
          ],
          relatedRoute: '/app/fournisseurs',
          relatedRouteLabel: 'Aller vers Fournisseurs'
        }
      ]
    },
    {
      id: 'reclamations',
      title: 'Créer et suivre une réclamation',
      shortTitle: 'Réclamations',
      description: 'Création, suivi, traitement, priorité, escalade, clôture et notifications.',
      badge: 'RC',
      route: '/app/reclamations',
      questions: [
        {
          id: 'reclamation-create',
          label: 'Quand dois-je créer une réclamation ?',
          answer: 'Tu dois créer une réclamation lorsqu’un outil, un emplacement, une matière, une désignation ou une donnée présente un problème.',
          steps: [
            'Repère l’élément concerné.',
            'Clique sur le bouton vert réclamation.',
            'Choisis le type de problème.',
            'Ajoute une description claire.',
            'Choisis la priorité.',
            'Envoie la réclamation.'
          ],
          relatedRoute: '/app/reclamations',
          relatedRouteLabel: 'Voir Réclamations'
        },
        {
          id: 'reclamation-rules',
          label: 'Qui traite les réclamations selon le rôle ?',
          answer: 'Les réclamations envoyées par un employé sont traitées par le responsable. Les réclamations envoyées par un responsable sont traitées par l’administrateur. L’administrateur traite mais ne passe pas de réclamation.',
          steps: [
            'Employé : peut créer une réclamation.',
            'Responsable : traite les réclamations des employés.',
            'Responsable : peut suivre ses propres réclamations.',
            'Admin : traite les réclamations des responsables.',
            'Admin : ne passe pas de réclamation.'
          ],
          relatedRoute: '/app/reclamations',
          relatedRouteLabel: 'Voir règles'
        }
      ]
    },
    {
      id: 'notifications',
      title: 'Comprendre les notifications',
      shortTitle: 'Notifications',
      description: 'Notifications lues, non lues, demandes d’accès, réclamations et sécurité.',
      badge: 'NT',
      route: '/app/notifications',
      questions: [
        {
          id: 'notifications-role',
          label: 'À quoi servent les notifications ?',
          answer: 'Les notifications informent l’utilisateur des événements importants : réclamations, demandes d’accès, traitement, modification ou action à vérifier.',
          steps: [
            'Clique sur l’icône notification dans la topbar.',
            'Consulte la liste des notifications.',
            'Filtre entre lues et non lues.',
            'Ouvre la notification concernée.'
          ],
          relatedRoute: '/app/notifications',
          relatedRouteLabel: 'Voir Notifications'
        },
        {
          id: 'notifications-access-request',
          label: 'Où l’admin traite les demandes d’accès ?',
          answer: 'Les demandes d’accès sont affichées dans la page Notifications, dans l’espace réservé aux demandes de compte.',
          steps: [
            'Connecte-toi comme administrateur.',
            'Ouvre Notifications.',
            'Va dans la section Demandes d’accès.',
            'Consulte les informations du demandeur.',
            'Accepte ou refuse la demande.'
          ],
          relatedRoute: '/app/notifications',
          relatedRouteLabel: 'Traiter demandes'
        }
      ]
    },
    {
      id: 'users',
      title: 'Gérer les utilisateurs et les rôles',
      shortTitle: 'Utilisateurs',
      description: 'Comptes, rôles ADMIN / RESPONSABLE / EMPLOYE, accès et permissions.',
      badge: 'US',
      route: '/app/users',
      questions: [
        {
          id: 'roles-definition',
          label: 'Quelle est la différence entre ADMIN, RESPONSABLE et EMPLOYÉ ?',
          answer: 'ADMIN possède tous les privilèges. RESPONSABLE gère les données métier et traite les réclamations des employés. EMPLOYÉ consulte les données autorisées et peut créer des réclamations.',
          steps: [
            'ADMIN : accès complet.',
            'RESPONSABLE : gestion métier et traitement des réclamations employés.',
            'EMPLOYÉ : consultation et réclamation.',
            'Les boutons changent selon le rôle.'
          ],
          relatedRoute: '/app/users',
          relatedRouteLabel: 'Voir Utilisateurs'
        },
        {
          id: 'users-create',
          label: 'Comment créer un utilisateur ?',
          answer: 'Un administrateur peut créer un utilisateur depuis la page Utilisateurs inscrits en remplissant le nom, email, mot de passe et rôle.',
          steps: [
            'Connecte-toi comme ADMIN.',
            'Va dans Utilisateurs inscrits.',
            'Clique sur Nouveau.',
            'Remplis les champs.',
            'Choisis le rôle.',
            'Valide.'
          ],
          relatedRoute: '/app/users',
          relatedRouteLabel: 'Créer utilisateur'
        }
      ]
    },
    {
      id: 'access',
      title: 'Demander un compte et récupérer l’accès',
      shortTitle: 'Accès compte',
      description: 'Demande d’accès, validation admin, email d’acceptation et connexion.',
      badge: 'AC',
      route: '/access-request',
      questions: [
        {
          id: 'access-request',
          label: 'Comment demander un compte si je n’en ai pas ?',
          answer: 'Depuis la page de connexion, l’utilisateur peut cliquer sur la demande d’accès et remplir ses informations : matricule TIS, email, numéro et message.',
          steps: [
            'Va sur la page Login.',
            'Clique sur Vous n’avez pas de compte ?',
            'Remplis les informations demandées.',
            'Clique sur demander un compte.',
            'Attends la validation de l’administrateur.'
          ],
          relatedRoute: '/access-request',
          relatedRouteLabel: 'Demander compte'
        },
        {
          id: 'access-admin-validation',
          label: 'Que se passe-t-il après l’envoi d’une demande d’accès ?',
          answer: 'La demande est enregistrée puis affichée à l’administrateur dans Notifications. L’administrateur peut accepter ou refuser.',
          steps: [
            'La demande est enregistrée.',
            'L’admin la consulte dans Notifications.',
            'L’admin vérifie les informations.',
            'L’admin accepte ou refuse.',
            'Un email peut être envoyé à l’utilisateur.'
          ],
          relatedRoute: '/app/notifications',
          relatedRouteLabel: 'Voir demandes'
        }
      ]
    },
    {
      id: 'security',
      title: 'Sécurité et mot de passe',
      shortTitle: 'Sécurité',
      description: 'Connexion, reCAPTCHA, mot de passe oublié, email de réinitialisation et protection.',
      badge: 'SC',
      route: '/login',
      questions: [
        {
          id: 'security-recaptcha',
          label: 'Pourquoi il y a un reCAPTCHA à la connexion ?',
          answer: 'Le reCAPTCHA protège la page de connexion contre les robots et les tentatives automatisées.',
          steps: [
            'Saisis ton email.',
            'Saisis ton mot de passe.',
            'Coche le reCAPTCHA.',
            'Valide la connexion.'
          ],
          relatedRoute: '/login',
          relatedRouteLabel: 'Connexion'
        },
        {
          id: 'security-forgot-password',
          label: 'Comment récupérer mon mot de passe ?',
          answer: 'Depuis la page de connexion, clique sur Mot de passe oublié, saisis ton email puis consulte le lien envoyé par email.',
          steps: [
            'Clique sur Mot de passe oublié.',
            'Saisis ton email.',
            'Clique sur Envoyer le lien.',
            'Ouvre l’email reçu.',
            'Saisis un nouveau mot de passe.'
          ],
          relatedRoute: '/forgot-password',
          relatedRouteLabel: 'Mot de passe oublié'
        },
        {
          id: 'security-reset-token',
          label: 'Pourquoi le token de réinitialisation peut être invalide ?',
          answer: 'Le token peut être invalide s’il est expiré, mal copié, déjà utilisé ou si le lien a été modifié.',
          steps: [
            'Vérifie que tu as ouvert le dernier email reçu.',
            'Ne modifie pas le lien.',
            'Demande un nouveau lien si nécessaire.',
            'Réessaie rapidement après réception.'
          ],
          relatedRoute: '/forgot-password',
          relatedRouteLabel: 'Nouveau lien'
        }
      ]
    },
    {
      id: 'profile',
      title: 'Gérer mon profil',
      shortTitle: 'Profil',
      description: 'Informations personnelles, photo, email, téléphone et mot de passe.',
      badge: 'PR',
      route: '/app/profile',
      questions: [
        {
          id: 'profile-info',
          label: 'Comment modifier mes informations personnelles ?',
          answer: 'Tu peux modifier tes informations depuis la page Profil, si l’action est disponible.',
          steps: [
            'Va dans Profil.',
            'Clique sur Modifier.',
            'Mets à jour les informations.',
            'Enregistre.',
            'Vérifie que la topbar est mise à jour.'
          ],
          relatedRoute: '/app/profile',
          relatedRouteLabel: 'Aller vers Profil'
        },
        {
          id: 'profile-role',
          label: 'Où vérifier mon rôle ?',
          answer: 'Ton rôle est visible dans le profil et dans la sidebar. Il détermine les pages et actions auxquelles tu as accès.',
          steps: [
            'Ouvre Profil.',
            'Regarde le rôle affiché.',
            'Compare avec les boutons visibles.',
            'Contacte l’admin si le rôle est incorrect.'
          ],
          relatedRoute: '/app/profile',
          relatedRouteLabel: 'Voir rôle'
        }
      ]
    },
    {
      id: 'roles',
      title: 'Accès selon les rôles',
      shortTitle: 'Rôles',
      description: 'Pages visibles selon Employé, Responsable et Admin.',
      badge: 'RL',
      route: '/app/profile',
      questions: [
        {
          id: 'role-employe-pages',
          label: 'Quelles pages voit un employé ?',
          answer: 'Un employé voit les pages nécessaires à la consultation et au suivi : Dashboard, Outillages, Emplacements et Assistance intelligente.',
          steps: [
            'Connecte-toi comme Employé.',
            'Regarde la sidebar.',
            'Tu dois voir les pages autorisées.',
            'Les pages de gestion avancée sont masquées.'
          ],
          relatedRoute: '/app/profile',
          relatedRouteLabel: 'Vérifier rôle'
        },
        {
          id: 'role-admin-pages',
          label: 'Quelles pages voit un administrateur ?',
          answer: 'L’administrateur peut accéder à toutes les pages, y compris Utilisateurs inscrits et Historique.',
          steps: [
            'Connecte-toi comme ADMIN.',
            'Vérifie la sidebar.',
            'Utilise Utilisateurs pour gérer les comptes.',
            'Utilise Historique pour la traçabilité.'
          ],
          relatedRoute: '/app/users',
          relatedRouteLabel: 'Voir Utilisateurs'
        }
      ]
    },
    {
      id: 'imports',
      title: 'Importer et exporter des données',
      shortTitle: 'Import / Export',
      description: 'Modèle Excel, import en masse, téléchargement des données et fiches PDF.',
      badge: 'IM',
      questions: [
        {
          id: 'import-how',
          label: 'Comment faire un import en masse ?',
          answer: 'L’import en masse permet d’ajouter plusieurs lignes rapidement depuis un fichier Excel ou CSV.',
          steps: [
            'Clique sur Modèle Excel.',
            'Remplis le fichier sans modifier les noms de colonnes.',
            'Clique sur Import.',
            'Sélectionne le fichier.',
            'Valide l’import.'
          ]
        },
        {
          id: 'import-error',
          label: 'Pourquoi mon import échoue ?',
          answer: 'Un import peut échouer si le fichier n’a pas le bon format, si une colonne obligatoire manque ou si une référence n’existe pas.',
          steps: [
            'Vérifie le modèle téléchargé.',
            'Contrôle les colonnes obligatoires.',
            'Vérifie les noms et les ID.',
            'Supprime les lignes vides.',
            'Réessaie l’import.'
          ]
        }
      ]
    },
    {
      id: 'errors',
      title: 'Résoudre les erreurs fréquentes',
      shortTitle: 'Erreurs',
      description: 'Connexion, rôle, API, backend, SQL Server, import ou permission.',
      badge: 'ER',
      questions: [
        {
          id: 'error-401-403',
          label: 'Que signifient les erreurs 401 ou 403 ?',
          answer: '401 signifie que l’utilisateur n’est pas authentifié. 403 signifie que le rôle connecté n’a pas l’autorisation d’accéder à l’action demandée.',
          steps: [
            'Reconnecte-toi.',
            'Vérifie ton rôle.',
            'Vérifie que le token est bien enregistré.',
            'Contacte l’admin si l’accès devrait être autorisé.'
          ],
          relatedRoute: '/login',
          relatedRouteLabel: 'Se reconnecter'
        },
        {
          id: 'error-backend',
          label: 'Pourquoi l’application ne charge pas les données ?',
          answer: 'Cela peut arriver si le backend ASP.NET Core n’est pas lancé, si SQL Server est arrêté ou si l’URL API est incorrecte.',
          steps: [
            'Ouvre le terminal backend.',
            'Lance dotnet run.',
            'Vérifie que SQL Server fonctionne.',
            'Recharge la page Angular.'
          ]
        }
      ]
    }
  ];

  ngOnInit(): void {
    this.loadConversations();

    if (this.conversations.length > 0) {
      this.openConversation(this.conversations[0].id);
    } else {
      this.createNewConversation();
    }
  }

  get messages(): ChatMessage[] {
    return this.currentConversation?.messages || [];
  }

  get filteredTopics(): HelpTopic[] {
    const search = this.normalize(this.searchText);

    if (!search) {
      return this.topics;
    }

    return this.topics.filter(topic => {
      const topicMatches =
        this.normalize(topic.title).includes(search) ||
        this.normalize(topic.shortTitle).includes(search) ||
        this.normalize(topic.description).includes(search) ||
        this.normalize(topic.badge).includes(search);

      const questionMatches = topic.questions.some(question => {
        const stepsText = question.steps ? question.steps.join(' ') : '';

        return (
          this.normalize(question.label).includes(search) ||
          this.normalize(question.answer).includes(search) ||
          this.normalize(stepsText).includes(search)
        );
      });

      return topicMatches || questionMatches;
    });
  }

  get activeQuestions(): HelpQuestion[] {
    if (!this.selectedTopic) {
      return [];
    }

    const search = this.normalize(this.searchText);

    if (!search) {
      return this.selectedTopic.questions;
    }

    return this.selectedTopic.questions.filter(question => {
      const stepsText = question.steps ? question.steps.join(' ') : '';

      return (
        this.normalize(question.label).includes(search) ||
        this.normalize(question.answer).includes(search) ||
        this.normalize(stepsText).includes(search)
      );
    });
  }

  get userInitials(): string {
    const name =
      this.authService.getFullName() ||
      localStorage.getItem('fullName') ||
      'Utilisateur';

    return name
      .split(' ')
      .filter(part => part.trim().length > 0)
      .map(part => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  get userDisplayName(): string {
    return this.authService.getFullName() || localStorage.getItem('fullName') || 'Utilisateur';
  }

  createNewConversation(): void {
    const now = new Date().toISOString();

    const conversation: AssistanceConversation = {
      id: this.createId(),
      title: 'Nouvelle assistance',
      selectedTopicId: null,
      selectedQuestionId: null,
      messages: [
        {
          id: this.createId(),
          from: 'bot',
          text: 'Bonjour. Je suis ton assistant iTools. Choisis d’abord une rubrique pour que je puisse te guider.',
          type: 'topic-selection',
          createdAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    this.conversations = [conversation, ...this.conversations];
    this.currentConversation = conversation;
    this.selectedTopic = null;
    this.selectedQuestion = null;

    this.saveConversations();
    this.scrollChatToBottom();
  }

  openConversation(conversationId: string): void {
    const conversation = this.conversations.find(item => item.id === conversationId);

    if (!conversation) {
      return;
    }

    this.currentConversation = conversation;

    this.selectedTopic =
      conversation.selectedTopicId
        ? this.topics.find(topic => topic.id === conversation.selectedTopicId) || null
        : null;

    this.selectedQuestion =
      this.selectedTopic && conversation.selectedQuestionId
        ? this.selectedTopic.questions.find(question => question.id === conversation.selectedQuestionId) || null
        : null;

    this.scrollChatToBottom();
  }

  deleteConversation(conversationId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    this.conversations = this.conversations.filter(item => item.id !== conversationId);

    if (this.currentConversation?.id === conversationId) {
      if (this.conversations.length > 0) {
        this.openConversation(this.conversations[0].id);
      } else {
        this.createNewConversation();
      }
    }

    this.saveConversations();
  }

  clearHistory(): void {
    const confirmed = window.confirm('Supprimer tout l’historique des conversations ?');

    if (!confirmed) {
      return;
    }

    this.conversations = [];
    this.currentConversation = null;
    this.selectedTopic = null;
    this.selectedQuestion = null;

    this.saveConversations();
    this.createNewConversation();
  }

  resetCurrentConversation(): void {
    if (!this.currentConversation) {
      this.createNewConversation();
      return;
    }

    const now = new Date().toISOString();

    this.currentConversation.title = 'Nouvelle assistance';
    this.currentConversation.selectedTopicId = null;
    this.currentConversation.selectedQuestionId = null;
    this.currentConversation.updatedAt = now;
    this.currentConversation.messages = [
      {
        id: this.createId(),
        from: 'bot',
        text: 'Conversation réinitialisée. Choisis une rubrique pour recommencer.',
        type: 'topic-selection',
        createdAt: now
      }
    ];

    this.selectedTopic = null;
    this.selectedQuestion = null;

    this.saveConversations();
    this.scrollChatToBottom();
  }

  selectTopic(topic: HelpTopic): void {
    if (!this.currentConversation) {
      this.createNewConversation();
    }

    if (!this.currentConversation) {
      return;
    }

    const now = new Date().toISOString();

    this.selectedTopic = topic;
    this.selectedQuestion = null;

    this.currentConversation.selectedTopicId = topic.id;
    this.currentConversation.selectedQuestionId = null;
    this.currentConversation.title = topic.shortTitle;
    this.currentConversation.updatedAt = now;

    this.currentConversation.messages.push({
      id: this.createId(),
      from: 'user',
      text: `Rubrique sélectionnée : ${topic.shortTitle}`,
      type: 'text',
      topicId: topic.id,
      createdAt: now
    });

    this.currentConversation.messages.push({
      id: this.createId(),
      from: 'bot',
      text: `Très bien. Tu as choisi la rubrique "${topic.title}". Sélectionne maintenant une question dans la zone basse de la conversation.`,
      type: 'text',
      topicId: topic.id,
      createdAt: now
    });

    this.saveConversations();
    this.scrollChatToBottom();
  }

  selectQuestion(question: HelpQuestion): void {
    if (!this.currentConversation || !this.selectedTopic) {
      return;
    }

    const now = new Date().toISOString();

    this.selectedQuestion = question;

    this.currentConversation.selectedQuestionId = question.id;
    this.currentConversation.updatedAt = now;
    this.currentConversation.title = question.label;

    this.currentConversation.messages.push({
      id: this.createId(),
      from: 'user',
      text: question.label,
      type: 'text',
      topicId: this.selectedTopic.id,
      createdAt: now
    });

    this.currentConversation.messages.push({
      id: this.createId(),
      from: 'bot',
      text: question.answer,
      type: 'answer',
      topicId: this.selectedTopic.id,
      question,
      createdAt: now
    });

    this.saveConversations();
    this.scrollChatToBottom();
  }

  goToRoute(route?: string): void {
    if (!route) {
      return;
    }

    this.router.navigate([route]);
  }

  getTopicById(topicId: string): HelpTopic | undefined {
    return this.topics.find(topic => topic.id === topicId);
  }

  getConversationPreview(conversation: AssistanceConversation): string {
    const lastMessage = [...conversation.messages]
      .reverse()
      .find(message => message.text && message.text.trim().length > 0);

    if (!lastMessage) {
      return 'Nouvelle conversation';
    }

    return lastMessage.text.length > 58
      ? `${lastMessage.text.slice(0, 58)}...`
      : lastMessage.text;
  }

  formatConversationDate(value: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private loadConversations(): void {
    const raw = localStorage.getItem(this.storageKey);

    if (!raw) {
      this.conversations = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AssistanceConversation[];

      this.conversations = Array.isArray(parsed)
        ? parsed.filter(item => item && item.id && Array.isArray(item.messages))
        : [];
    } catch {
      this.conversations = [];
    }
  }

  private saveConversations(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.conversations));
  }

  private get storageKey(): string {
    const fullName =
      this.authService.getFullName() ||
      localStorage.getItem('fullName') ||
      localStorage.getItem('email') ||
      localStorage.getItem('userEmail') ||
      'default-user';

    return `itools-assistance-conversations-${this.normalize(fullName) || 'default-user'}`;
  }

  private scrollChatToBottom(): void {
    window.setTimeout(() => {
      const chatBody = document.querySelector('.chat-body');

      if (chatBody) {
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    }, 80);
  }

  private createId(): string {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private normalize(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}