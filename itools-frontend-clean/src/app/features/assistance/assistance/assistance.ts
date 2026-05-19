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
      description: 'Statistiques, cartes, graphiques, couleurs et interprétation des données.',
      badge: 'DB',
      route: '/app/dashboard',
      questions: [
        {
          id: 'dashboard-role',
          label: 'À quoi sert le Dashboard ?',
          answer: 'Le Dashboard donne une vue rapide de l’état global du système : emplacements libres, outillages, emplacements hors service et utilisateurs inscrits.',
          steps: [
            'Consulte les cartes en haut pour voir les chiffres principaux.',
            'Lis le graphique en bâtons pour voir les réservations par outil.',
            'Lis le graphique circulaire pour comparer Libre, Occupé et HS.',
            'Utilise les pages détaillées si tu veux modifier les données.'
          ],
          relatedRoute: '/app/dashboard',
          relatedRouteLabel: 'Aller vers Dashboard'
        },
        {
          id: 'dashboard-colors',
          label: 'Que signifient les couleurs des cartes ?',
          answer: 'Les couleurs servent à identifier rapidement les informations : vert pour les emplacements libres, bleu pour les outillages, rouge pour les emplacements HS et jaune pour les utilisateurs inscrits.',
          steps: [
            'Vert : disponible ou positif.',
            'Bleu : information liée aux outillages.',
            'Rouge : problème ou élément critique.',
            'Jaune : information liée aux utilisateurs.'
          ],
          relatedRoute: '/app/dashboard',
          relatedRouteLabel: 'Voir le Dashboard'
        },
        {
          id: 'dashboard-charts',
          label: 'Comment lire les graphiques ?',
          answer: 'Le graphique en bâtons montre les emplacements réservés par outil. Le graphique circulaire montre la répartition globale entre Libre, Occupé et HS.',
          steps: [
            'Place le curseur sur le graphique pour afficher le détail.',
            'Compare les valeurs entre outils ou statuts.',
            'Si une valeur semble incorrecte, vérifie les pages Emplacements ou Outils.'
          ],
          relatedRoute: '/app/emplacements',
          relatedRouteLabel: 'Vérifier les emplacements'
        }
      ]
    },
    {
      id: 'profile',
      title: 'Gérer mon profil',
      shortTitle: 'Profil',
      description: 'Informations personnelles, photo de profil, mot de passe et sécurité.',
      badge: 'PR',
      route: '/app/profile',
      questions: [
        {
          id: 'profile-info',
          label: 'Comment modifier mes informations personnelles ?',
          answer: 'Les informations personnelles sont affichées en aperçu. Pour les modifier, il faut cliquer sur Modifier, remplir le formulaire dans la fenêtre, puis cliquer sur Conserver.',
          steps: [
            'Va dans la page Profil.',
            'Ouvre Informations personnelles.',
            'Clique sur Modifier.',
            'Modifie les champs nécessaires.',
            'Clique sur Conserver.'
          ],
          relatedRoute: '/app/profile',
          relatedRouteLabel: 'Aller vers Profil'
        },
        {
          id: 'profile-photo',
          label: 'Comment modifier ma photo de profil ?',
          answer: 'Dans Photo de profil, tu peux voir, modifier ou supprimer la photo. Pour modifier, tu peux prendre une photo avec la caméra ou importer une image.',
          steps: [
            'Va dans Profil puis Photo de profil.',
            'Clique sur Modifier photo.',
            'Choisis caméra ou import depuis ton appareil.',
            'Vérifie l’aperçu.',
            'Conserve la photo ou sélectionne une autre.'
          ],
          relatedRoute: '/app/profile',
          relatedRouteLabel: 'Gérer ma photo'
        },
        {
          id: 'profile-password',
          label: 'Pourquoi mon mot de passe est refusé ?',
          answer: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.',
          steps: [
            'Saisis ton mot de passe actuel.',
            'Saisis un nouveau mot de passe valide.',
            'Confirme le nouveau mot de passe.',
            'Clique sur Changer mot de passe.'
          ],
          relatedRoute: '/app/profile',
          relatedRouteLabel: 'Changer mon mot de passe'
        }
      ]
    },
    {
      id: 'notifications',
      title: 'Comprendre les notifications',
      shortTitle: 'Notifications',
      description: 'Notifications lues, non lues, profil, sécurité et réclamations.',
      badge: 'NT',
      route: '/app/notifications',
      questions: [
        {
          id: 'notifications-role',
          label: 'À quoi servent les notifications ?',
          answer: 'Les notifications informent l’utilisateur des événements importants : modification du profil, changement du mot de passe, réclamation ou action nécessitant une attention.',
          steps: [
            'Clique sur l’icône notification dans la topbar.',
            'Consulte la liste des notifications.',
            'Filtre les notifications lues ou non lues.',
            'Supprime les notifications inutiles si nécessaire.'
          ],
          relatedRoute: '/app/notifications',
          relatedRouteLabel: 'Voir les notifications'
        },
        {
          id: 'notifications-unread',
          label: 'Que signifie notification non lue ?',
          answer: 'Une notification non lue est une notification que tu n’as pas encore consultée ou marquée comme lue.',
          steps: [
            'Ouvre la page Notifications.',
            'Filtre par Non lues.',
            'Lis la notification.',
            'Marque-la comme lue si l’action est disponible.'
          ],
          relatedRoute: '/app/notifications',
          relatedRouteLabel: 'Ouvrir Notifications'
        }
      ]
    },
    {
      id: 'reclamations',
      title: 'Créer ou suivre une réclamation',
      shortTitle: 'Réclamations',
      description: 'Création, suivi, traitement, escalade et clôture des réclamations.',
      badge: 'RC',
      route: '/app/reclamations',
      questions: [
        {
          id: 'reclamation-create',
          label: 'Quand dois-je créer une réclamation ?',
          answer: 'Tu dois créer une réclamation lorsqu’un problème est détecté : outil HS, emplacement incorrect, stock critique, erreur de données ou anomalie.',
          steps: [
            'Repère l’élément concerné.',
            'Clique sur Passer réclamation si le bouton existe.',
            'Décris clairement le problème.',
            'Choisis la priorité.',
            'Envoie la réclamation.'
          ],
          relatedRoute: '/app/reclamations',
          relatedRouteLabel: 'Voir les réclamations'
        },
        {
          id: 'reclamation-status',
          label: 'Que signifient À traiter, En cours et Clôturée ?',
          answer: 'À traiter signifie que la réclamation attend une action. En cours signifie qu’elle est prise en charge. Clôturée signifie que le problème a été traité.',
          steps: [
            'Filtre les réclamations selon le statut.',
            'Consulte les détails.',
            'Traite ou escalade si ton rôle le permet.',
            'Clôture uniquement quand le problème est résolu.'
          ],
          relatedRoute: '/app/reclamations',
          relatedRouteLabel: 'Suivre une réclamation'
        },
        {
          id: 'reclamation-read',
          label: 'Comment différencier les réclamations vues et non lues ?',
          answer: 'Les réclamations non lues sont celles qui n’ont pas encore été consultées ou marquées comme lues.',
          steps: [
            'Va dans Réclamations.',
            'Utilise le filtre Vues / Non lues.',
            'Clique sur Marquer comme lu après consultation.',
            'Utilise les autres filtres pour chercher par ligne, outil ou fournisseur.'
          ],
          relatedRoute: '/app/reclamations',
          relatedRouteLabel: 'Filtrer les réclamations'
        }
      ]
    },
    {
      id: 'designations',
      title: 'Comprendre les désignations',
      shortTitle: 'Désignations',
      description: 'Nom, type, liste, images, tri, création et import des désignations.',
      badge: 'DS',
      route: '/app/designations',
      questions: [
        {
          id: 'designation-definition',
          label: 'C’est quoi une désignation ?',
          answer: 'Une désignation représente le nom ou la catégorie d’un élément utilisé dans les emplacements et les outils.',
          steps: [
            'Va dans Désignations.',
            'Consulte le nom de la désignation.',
            'Regarde le type associé.',
            'Utilise la vue Liste ou Images.'
          ],
          relatedRoute: '/app/designations',
          relatedRouteLabel: 'Aller vers Désignations'
        },
        {
          id: 'designation-tool-diff',
          label: 'Quelle est la différence entre désignation et outil ?',
          answer: 'La désignation décrit un type ou une référence générale. L’outil représente un outillage réel avec code, OTT, client, fournisseur et emplacement.',
          steps: [
            'Utilise Désignations pour gérer les noms ou catégories.',
            'Utilise Outils pour gérer les outillages réels.',
            'Un outil peut être lié à une désignation via son emplacement.'
          ],
          relatedRoute: '/app/outils',
          relatedRouteLabel: 'Voir les outils'
        }
      ]
    },
    {
      id: 'lignes',
      title: 'Comprendre les lignes',
      shortTitle: 'Lignes',
      description: 'Lignes de production, ajout, tri, import et relation avec les outils.',
      badge: 'LG',
      route: '/app/lignes',
      questions: [
        {
          id: 'ligne-definition',
          label: 'C’est quoi une ligne ?',
          answer: 'Une ligne représente généralement une ligne de production, une zone ou une chaîne utilisée dans l’organisation de l’usine.',
          steps: [
            'Va dans Lignes.',
            'Consulte les lignes existantes.',
            'Ajoute une nouvelle ligne si elle n’existe pas.',
            'Utilise le tri ou la recherche.'
          ],
          relatedRoute: '/app/lignes',
          relatedRouteLabel: 'Aller vers Lignes'
        }
      ]
    },
    {
      id: 'clients',
      title: 'Comprendre les clients',
      shortTitle: 'Clients',
      description: 'Nom client, famille, référence, filtre, import et relation avec les outils.',
      badge: 'CL',
      route: '/app/clients',
      questions: [
        {
          id: 'client-fields',
          label: 'Quelle est la différence entre nom client, famille et référence ?',
          answer: 'Le nom client identifie le client principal. La famille représente une catégorie ou famille de produit. La référence distingue une référence spécifique liée au client.',
          steps: [
            'Va dans Clients.',
            'Vérifie nom client, famille et référence.',
            'Utilise ces informations pour retrouver les outils associés.'
          ],
          relatedRoute: '/app/clients',
          relatedRouteLabel: 'Aller vers Clients'
        }
      ]
    },
    {
      id: 'fournisseurs',
      title: 'Comprendre les fournisseurs',
      shortTitle: 'Fournisseurs',
      description: 'Code fournisseur, nom fournisseur, ajout, import et relation avec les outils.',
      badge: 'FR',
      route: '/app/fournisseurs',
      questions: [
        {
          id: 'fournisseur-definition',
          label: 'Pourquoi un fournisseur est lié à un outil ?',
          answer: 'Le fournisseur permet de savoir d’où vient un outil ou quelle entité est associée à son approvisionnement.',
          steps: [
            'Va dans Fournisseurs.',
            'Vérifie le code fournisseur et le nom fournisseur.',
            'Consulte ensuite Outils pour voir les outils associés.'
          ],
          relatedRoute: '/app/fournisseurs',
          relatedRouteLabel: 'Aller vers Fournisseurs'
        }
      ]
    },
    {
      id: 'users',
      title: 'Gérer les utilisateurs',
      shortTitle: 'Utilisateurs',
      description: 'Rôles admin, responsable, employé, filtres, couleurs et permissions.',
      badge: 'US',
      route: '/app/users',
      questions: [
        {
          id: 'roles-definition',
          label: 'Quelle est la différence entre ADMIN, RESPONSABLE et EMPLOYÉ ?',
          answer: 'ADMIN gère l’application et les données sensibles. RESPONSABLE suit ou traite certaines réclamations. EMPLOYÉ consulte les données autorisées et peut créer des réclamations selon les permissions.',
          steps: [
            'Va dans Utilisateurs inscrits.',
            'Regarde la colonne Rôle.',
            'Utilise le filtre par rôle.',
            'Les couleurs permettent de distinguer les rôles rapidement.'
          ],
          relatedRoute: '/app/users',
          relatedRouteLabel: 'Voir les utilisateurs'
        },
        {
          id: 'permission-hidden-button',
          label: 'Pourquoi certains boutons ne s’affichent pas ?',
          answer: 'Certains boutons dépendent du rôle de l’utilisateur connecté. Si un bouton n’apparaît pas, cela peut être une restriction d’accès.',
          steps: [
            'Vérifie ton rôle dans ton profil.',
            'Compare avec les permissions attendues.',
            'Contacte un administrateur si tu penses qu’il y a une erreur.'
          ],
          relatedRoute: '/app/profile',
          relatedRouteLabel: 'Vérifier mon profil'
        }
      ]
    },
    {
      id: 'emplacements',
      title: 'Comprendre les emplacements',
      shortTitle: 'Emplacements',
      description: 'Armoire, numéro, matière, désignation, statut Libre, Occupé et HS.',
      badge: 'EM',
      route: '/app/emplacements',
      questions: [
        {
          id: 'emplacement-definition',
          label: 'C’est quoi un emplacement ?',
          answer: 'Un emplacement représente un endroit physique ou logique où un outil peut être rangé ou affecté.',
          steps: [
            'Va dans Emplacements.',
            'Regarde matière, armoire, numéro et désignation.',
            'Vérifie le statut.',
            'Utilise les filtres pour chercher rapidement.'
          ],
          relatedRoute: '/app/emplacements',
          relatedRouteLabel: 'Aller vers Emplacements'
        },
        {
          id: 'emplacement-status',
          label: 'Que signifient Libre, Occupé et HS ?',
          answer: 'Libre signifie disponible. Occupé signifie qu’un outil est affecté ou utilisé. HS signifie hors service.',
          steps: [
            'Filtre les emplacements par statut.',
            'Vérifie les emplacements HS.',
            'Passe une réclamation si un problème est constaté.'
          ],
          relatedRoute: '/app/emplacements',
          relatedRouteLabel: 'Filtrer les emplacements'
        }
      ]
    },
    {
      id: 'matieres',
      title: 'Comprendre les matières',
      shortTitle: 'Matières',
      description: 'Matière, process Pb, ROHS, filtre, tri, import et relation avec emplacements.',
      badge: 'MT',
      route: '/app/matieres',
      questions: [
        {
          id: 'matiere-definition',
          label: 'C’est quoi une matière ?',
          answer: 'Une matière représente une matière utilisée dans les emplacements ou les outillages.',
          steps: [
            'Va dans Matières.',
            'Consulte le nom de la matière.',
            'Regarde le process associé.',
            'Filtre par process si nécessaire.'
          ],
          relatedRoute: '/app/matieres',
          relatedRouteLabel: 'Aller vers Matières'
        },
        {
          id: 'matiere-process',
          label: 'Que signifient Pb et ROHS ?',
          answer: 'Pb fait référence au plomb. ROHS désigne une conformité liée à la restriction de substances dangereuses.',
          steps: [
            'Va dans Matières.',
            'Utilise le filtre Process.',
            'Choisis Pb ou ROHS selon le besoin.'
          ],
          relatedRoute: '/app/matieres',
          relatedRouteLabel: 'Filtrer les matières'
        }
      ]
    },
    {
      id: 'outils',
      title: 'Comprendre les outils',
      shortTitle: 'Outils',
      description: 'Outillages, OTT, code outillage, client, fournisseur, emplacement et stock.',
      badge: 'OT',
      route: '/app/outils',
      questions: [
        {
          id: 'outil-definition',
          label: 'C’est quoi un outil dans iTools ?',
          answer: 'Un outil représente un outillage réel utilisé dans l’usine. Il peut être lié à une ligne, un client, un fournisseur, un emplacement, un OTT, un code outillage, un statut et une valeur de stock.',
          steps: [
            'Va dans Outils.',
            'Consulte ligne, client et fournisseur.',
            'Vérifie l’emplacement associé.',
            'Regarde le statut et la valeur.'
          ],
          relatedRoute: '/app/outils',
          relatedRouteLabel: 'Aller vers Outils'
        },
        {
          id: 'outil-ott',
          label: 'C’est quoi OTT ?',
          answer: 'OTT est une information technique associée à l’outil. Elle aide à identifier ou classifier l’outillage dans le contexte de production.',
          steps: [
            'Va dans Outils.',
            'Cherche la colonne OTT.',
            'Utilise la recherche globale pour retrouver un OTT précis.'
          ],
          relatedRoute: '/app/outils',
          relatedRouteLabel: 'Rechercher un OTT'
        },
        {
          id: 'outil-stock',
          label: 'Que signifie stock normal, risque épuisement ou épuisé ?',
          answer: 'Stock normal signifie que la valeur est suffisante. Risque épuisement signifie que la valeur est basse. Épuisé signifie que la valeur est à zéro ou critique.',
          steps: [
            'Consulte la colonne Valeur.',
            'Regarde le badge de stock.',
            'Passe une réclamation si le stock est critique.'
          ],
          relatedRoute: '/app/outils',
          relatedRouteLabel: 'Vérifier les outils'
        },
        {
          id: 'outil-hs',
          label: 'Pourquoi une justification HS est obligatoire ?',
          answer: 'Quand un outil est hors service, il faut expliquer la raison du problème. Cela permet aux responsables de comprendre pourquoi l’outil ne peut pas être utilisé.',
          steps: [
            'Choisis le statut HS.',
            'Renseigne la justification HS.',
            'Enregistre la modification.',
            'Passe une réclamation si une action est nécessaire.'
          ],
          relatedRoute: '/app/outils',
          relatedRouteLabel: 'Modifier un outil'
        }
      ]
    },
    {
      id: 'imports',
      title: 'Importer des données',
      shortTitle: 'Imports',
      description: 'Import en masse, modèle à remplir, colonnes obligatoires et erreurs.',
      badge: 'IM',
      questions: [
        {
          id: 'import-how',
          label: 'Comment importer des données ?',
          answer: 'L’import en masse permet d’ajouter plusieurs lignes depuis un fichier Excel ou CSV.',
          steps: [
            'Clique sur Télécharger modèle à remplir.',
            'Remplis le fichier avec les colonnes demandées.',
            'Clique sur Import en masse.',
            'Sélectionne ton fichier.',
            'Valide l’import.'
          ]
        },
        {
          id: 'import-error',
          label: 'Pourquoi mon import échoue ?',
          answer: 'Un import peut échouer si une colonne obligatoire manque, si un nom ne correspond pas aux données existantes, si un ID est incorrect ou si le fichier n’a pas le bon format.',
          steps: [
            'Vérifie le modèle téléchargé.',
            'Contrôle les colonnes obligatoires.',
            'Vérifie que les références existent déjà.',
            'Réessaie avec un fichier propre.'
          ]
        }
      ]
    },
    {
      id: 'archives',
      title: 'Comprendre l’historique',
      shortTitle: 'Historique',
      description: 'Calendrier, anciennes valeurs, nouvelles valeurs, actions et export.',
      badge: 'HI',
      route: '/app/archives',
      questions: [
        {
          id: 'archives-role',
          label: 'À quoi sert l’historique ?',
          answer: 'L’historique permet de suivre les opérations réalisées dans l’application : connexions, modifications, suppressions, changements de profil et autres actions importantes.',
          steps: [
            'Va dans Historique.',
            'Utilise le calendrier pour sélectionner une date.',
            'Clique sur une date pour voir l’aperçu.',
            'Ouvre les détails pour consulter les valeurs modifiées.'
          ],
          relatedRoute: '/app/archives',
          relatedRouteLabel: 'Aller vers Historique'
        },
        {
          id: 'archives-json',
          label: 'Pourquoi certaines valeurs sont affichées en JSON ?',
          answer: 'Les anciennes et nouvelles valeurs sont parfois affichées sous forme JSON pour montrer précisément ce qui a changé.',
          steps: [
            'Ouvre les détails d’une date.',
            'Compare Anciennes valeurs et Nouvelles valeurs.',
            'Repère les champs modifiés.'
          ],
          relatedRoute: '/app/archives',
          relatedRouteLabel: 'Voir les archives'
        }
      ]
    },
    {
      id: 'errors',
      title: 'Je rencontre une erreur',
      shortTitle: 'Erreurs',
      description: 'Erreur serveur, backend, SQL Server, mot de passe, import et permissions.',
      badge: 'ER',
      questions: [
        {
          id: 'error-backend',
          label: 'J’ai une erreur de connexion au serveur',
          answer: 'Cette erreur signifie souvent que le backend n’est pas lancé, que l’API n’est pas accessible ou que SQL Server n’est pas connecté.',
          steps: [
            'Vérifie que le backend iTools.Api est lancé.',
            'Vérifie que SQL Server est démarré.',
            'Vérifie la chaîne de connexion dans appsettings.json.',
            'Recharge la page après correction.'
          ]
        },
        {
          id: 'error-forbidden',
          label: 'Pourquoi une action est interdite ?',
          answer: 'Une action interdite signifie généralement que ton rôle ne possède pas la permission nécessaire pour cette opération.',
          steps: [
            'Vérifie ton rôle dans le profil.',
            'Essaie avec un compte autorisé.',
            'Contacte un administrateur si l’accès devrait être permis.'
          ],
          relatedRoute: '/app/profile',
          relatedRouteLabel: 'Vérifier mon rôle'
        },
        {
          id: 'error-password',
          label: 'Mon mot de passe est refusé',
          answer: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.',
          steps: [
            'Vérifie la longueur du mot de passe.',
            'Ajoute une majuscule.',
            'Ajoute une minuscule.',
            'Ajoute un chiffre.',
            'Ajoute un caractère spécial.'
          ],
          relatedRoute: '/app/profile',
          relatedRouteLabel: 'Changer le mot de passe'
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
        this.normalize(topic.description).includes(search);

      const questionMatches = topic.questions.some(question =>
        this.normalize(question.label).includes(search) ||
        this.normalize(question.answer).includes(search)
      );

      return topicMatches || questionMatches;
    });
  }

  get activeQuestions(): HelpQuestion[] {
    if (!this.selectedTopic) {
      return [];
    }

    return this.selectedTopic.questions;
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
    const confirmed = confirm('Supprimer tout l’historique des conversations ?');

    if (!confirmed) {
      return;
    }

    this.conversations = [];
    this.saveConversations();
    this.createNewConversation();
  }

  selectTopic(topic: HelpTopic): void {
    if (!this.currentConversation) {
      this.createNewConversation();
    }

    this.selectedTopic = topic;
    this.selectedQuestion = null;

    this.addUserMessage(topic.title);

    this.addBotMessage(
      `Très bien. Tu as choisi la rubrique "${topic.title}". Sélectionne maintenant la question qui correspond le mieux à ton besoin.`,
      'question-selection',
      topic.id
    );

    if (this.currentConversation) {
      this.currentConversation.selectedTopicId = topic.id;
      this.currentConversation.selectedQuestionId = null;
      this.currentConversation.title = topic.shortTitle;
      this.touchConversation();
    }

    this.saveConversations();
    this.scrollChatToBottom();
  }

  selectQuestion(question: HelpQuestion): void {
    if (!this.currentConversation) {
      this.createNewConversation();
    }

    this.selectedQuestion = question;

    this.addUserMessage(question.label);

    this.addBotMessage(question.answer, 'answer', this.selectedTopic?.id, question);

    if (this.currentConversation) {
      this.currentConversation.selectedQuestionId = question.id;
      this.currentConversation.title = question.label;
      this.touchConversation();
    }

    this.saveConversations();
    this.scrollChatToBottom();
  }

  resetCurrentConversation(): void {
    if (!this.currentConversation) {
      this.createNewConversation();
      return;
    }

    const now = new Date().toISOString();

    this.currentConversation.messages = [
      {
        id: this.createId(),
        from: 'bot',
        text: 'Conversation réinitialisée. Choisis une rubrique pour recommencer.',
        type: 'topic-selection',
        createdAt: now
      }
    ];

    this.currentConversation.selectedTopicId = null;
    this.currentConversation.selectedQuestionId = null;
    this.currentConversation.title = 'Nouvelle assistance';
    this.currentConversation.updatedAt = now;

    this.selectedTopic = null;
    this.selectedQuestion = null;

    this.saveConversations();
    this.scrollChatToBottom();
  }

  goToRoute(route?: string): void {
    if (!route) {
      return;
    }

    this.router.navigateByUrl(route);
  }

  formatConversationDate(value: string): string {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit'
    }) + ' ' + date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getConversationPreview(conversation: AssistanceConversation): string {
    const lastUserMessage = [...conversation.messages]
      .reverse()
      .find(message => message.from === 'user');

    if (lastUserMessage) {
      return lastUserMessage.text;
    }

    return 'Conversation d’assistance';
  }

  getTopicById(topicId?: string): HelpTopic | null {
    if (!topicId) {
      return null;
    }

    return this.topics.find(topic => topic.id === topicId) || null;
  }

  private addUserMessage(text: string): void {
    if (!this.currentConversation) {
      return;
    }

    this.currentConversation.messages.push({
      id: this.createId(),
      from: 'user',
      text,
      type: 'text',
      createdAt: new Date().toISOString()
    });

    this.touchConversation();
  }

  private addBotMessage(
    text: string,
    type: ChatMessage['type'] = 'text',
    topicId?: string,
    question?: HelpQuestion
  ): void {
    if (!this.currentConversation) {
      return;
    }

    this.currentConversation.messages.push({
      id: this.createId(),
      from: 'bot',
      text,
      type,
      topicId,
      question,
      createdAt: new Date().toISOString()
    });

    this.touchConversation();
  }

  private touchConversation(): void {
    if (!this.currentConversation) {
      return;
    }

    this.currentConversation.updatedAt = new Date().toISOString();

    this.conversations = [
      this.currentConversation,
      ...this.conversations.filter(item => item.id !== this.currentConversation?.id)
    ];
  }

  private loadConversations(): void {
    const raw = localStorage.getItem(this.getStorageKey());

    if (!raw) {
      this.conversations = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AssistanceConversation[];
      this.conversations = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.conversations = [];
    }
  }

  private saveConversations(): void {
    localStorage.setItem(this.getStorageKey(), JSON.stringify(this.conversations.slice(0, 30)));
  }

  private getStorageKey(): string {
    const email =
      this.authService.getEmail() ||
      localStorage.getItem('email') ||
      this.authService.getFullName() ||
      localStorage.getItem('fullName') ||
      'anonymous';

    return `itools_assistance_conversations_${this.normalize(email)}`;
  }

  private createId(): string {
    return `assist_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private normalize(value: string | null | undefined): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private scrollChatToBottom(): void {
    setTimeout(() => {
      const chatBody = document.querySelector('.chat-body');

      if (chatBody) {
        chatBody.scrollTop = chatBody.scrollHeight;
      }
    }, 80);
  }
}