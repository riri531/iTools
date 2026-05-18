import { Component } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

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
  from: 'bot' | 'user';
  text: string;
  question?: HelpQuestion;
}

@Component({
  selector: 'app-assistance',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, FormsModule],
  templateUrl: './assistance.html',
  styleUrl: './assistance.scss'
})
export class AssistanceComponent {
  searchText = '';

  selectedTopic: HelpTopic | null = null;
  selectedQuestion: HelpQuestion | null = null;

  messages: ChatMessage[] = [
    {
      from: 'bot',
      text: 'Bonjour. Je suis ton assistant iTools. Choisis une rubrique ou une question pour que je te guide étape par étape.'
    }
  ];

  topics: HelpTopic[] = [
    {
      id: 'dashboard',
      title: 'Comprendre le Dashboard',
      shortTitle: 'Dashboard',
      description: 'Statistiques, cartes, graphiques, couleurs et interprétation des données.',
      badge: 'DB',
      route: '/dashboard',
      questions: [
        {
          id: 'dashboard-role',
          label: 'À quoi sert le Dashboard ?',
          answer: 'Le Dashboard sert à donner une vue rapide de l’état global du système : emplacements libres, outillages, emplacements hors service et utilisateurs inscrits. Il permet surtout de comprendre la situation générale sans parcourir toutes les pages.',
          steps: [
            'Consulte les quatre cartes en haut pour voir les chiffres principaux.',
            'Observe le graphique en bâtons pour voir les réservations par outil.',
            'Observe le graphique circulaire pour comparer libre, occupé et HS.',
            'Utilise les autres pages si tu veux modifier les données.'
          ],
          relatedRoute: '/dashboard',
          relatedRouteLabel: 'Aller vers Dashboard'
        },
        {
          id: 'dashboard-colors',
          label: 'Que signifient les couleurs des cartes ?',
          answer: 'Les couleurs aident à reconnaître rapidement le type d’information : vert pour les emplacements libres, bleu pour les outillages, rouge pour les emplacements HS et jaune pour les utilisateurs inscrits.',
          steps: [
            'Vert : élément disponible ou situation positive.',
            'Bleu : information liée aux outillages.',
            'Rouge : problème, HS ou élément critique.',
            'Jaune : information liée aux utilisateurs ou à l’attention.'
          ],
          relatedRoute: '/dashboard',
          relatedRouteLabel: 'Voir les statistiques'
        },
        {
          id: 'dashboard-charts',
          label: 'Comment lire les graphiques ?',
          answer: 'Le graphique en bâtons montre les emplacements réservés par outil. Le graphique circulaire montre la répartition globale entre emplacements libres, occupés et HS.',
          steps: [
            'Place le curseur sur une zone du graphique pour afficher le détail.',
            'Compare les valeurs entre outils ou statuts.',
            'Si un nombre paraît incorrect, vérifie les données dans Emplacements ou Outils.'
          ],
          relatedRoute: '/emplacements',
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
      route: '/profile',
      questions: [
        {
          id: 'profile-info',
          label: 'Comment modifier mes informations personnelles ?',
          answer: 'Les informations personnelles sont affichées en aperçu. Pour les modifier, il faut cliquer sur le bouton Modifier, remplir le formulaire dans la fenêtre qui s’ouvre, puis cliquer sur Conserver.',
          steps: [
            'Va dans la page Profil.',
            'Ouvre la section Informations personnelles.',
            'Clique sur Modifier.',
            'Modifie les champs nécessaires.',
            'Clique sur Conserver pour enregistrer.'
          ],
          relatedRoute: '/profile',
          relatedRouteLabel: 'Aller vers Profil'
        },
        {
          id: 'profile-photo',
          label: 'Comment modifier ma photo de profil ?',
          answer: 'Dans la section Photo de profil, tu peux voir, modifier ou supprimer la photo. Pour modifier, tu peux prendre une photo avec la caméra ou importer une image depuis ton appareil.',
          steps: [
            'Va dans Profil puis Photo de profil.',
            'Clique sur Modifier photo.',
            'Choisis Prendre une photo ou Importer une image.',
            'Vérifie l’aperçu.',
            'Conserve la photo ou sélectionne une autre image.'
          ],
          relatedRoute: '/profile',
          relatedRouteLabel: 'Gérer ma photo'
        },
        {
          id: 'profile-password',
          label: 'Pourquoi mon mot de passe est refusé ?',
          answer: 'Le mot de passe doit respecter les règles de sécurité : au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.',
          steps: [
            'Saisis ton mot de passe actuel.',
            'Saisis un nouveau mot de passe valide.',
            'Confirme le nouveau mot de passe.',
            'Clique sur Changer mot de passe.'
          ],
          relatedRoute: '/profile',
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
      route: '/notifications',
      questions: [
        {
          id: 'notifications-role',
          label: 'À quoi servent les notifications ?',
          answer: 'Les notifications informent l’utilisateur des événements importants : modification du profil, changement du mot de passe, réclamation, escalade ou autre action nécessitant une attention.',
          steps: [
            'Clique sur l’icône notification dans la topbar.',
            'Consulte la liste des notifications.',
            'Filtre les notifications lues ou non lues.',
            'Supprime les notifications inutiles si nécessaire.'
          ],
          relatedRoute: '/notifications',
          relatedRouteLabel: 'Voir les notifications'
        },
        {
          id: 'notifications-unread',
          label: 'Que signifie notification non lue ?',
          answer: 'Une notification non lue est une notification que tu n’as pas encore consultée ou marquée comme lue. Elle peut être comptabilisée dans l’icône de la topbar.',
          steps: [
            'Ouvre la page Notifications.',
            'Filtre par Non lues.',
            'Lis la notification concernée.',
            'Marque-la comme lue si cette action est disponible.'
          ],
          relatedRoute: '/notifications',
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
      route: '/reclamations',
      questions: [
        {
          id: 'reclamation-create',
          label: 'Quand dois-je créer une réclamation ?',
          answer: 'Tu dois créer une réclamation lorsqu’un problème est détecté : outil HS, emplacement incorrect, stock critique, erreur de données ou anomalie dans une page.',
          steps: [
            'Repère l’élément concerné.',
            'Clique sur Passer réclamation si le bouton existe.',
            'Décris clairement le problème.',
            'Choisis la priorité.',
            'Envoie la réclamation.'
          ],
          relatedRoute: '/reclamations',
          relatedRouteLabel: 'Voir les réclamations'
        },
        {
          id: 'reclamation-status',
          label: 'Que signifient À traiter, En cours et Clôturée ?',
          answer: 'À traiter signifie que la réclamation attend une action. En cours signifie qu’elle est prise en charge. Clôturée signifie que le problème a été traité ou fermé.',
          steps: [
            'Filtre les réclamations selon leur statut.',
            'Consulte les détails de la réclamation.',
            'Si tu es responsable, traite ou escalade selon le cas.',
            'Clôture uniquement quand le problème est résolu.'
          ],
          relatedRoute: '/reclamations',
          relatedRouteLabel: 'Suivre une réclamation'
        },
        {
          id: 'reclamation-read',
          label: 'Comment différencier les réclamations vues et non lues ?',
          answer: 'Les réclamations non lues sont celles qui n’ont pas encore été consultées ou marquées comme lues. Le filtre permet de les isoler rapidement.',
          steps: [
            'Va dans la page Réclamations.',
            'Utilise le filtre Vues / Non lues.',
            'Clique sur Marquer comme lu après consultation.',
            'Utilise les autres filtres pour chercher par ligne, outil, fournisseur ou désignation.'
          ],
          relatedRoute: '/reclamations',
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
      route: '/designations',
      questions: [
        {
          id: 'designation-definition',
          label: 'C’est quoi une désignation ?',
          answer: 'Une désignation représente le nom ou la catégorie d’un élément utilisé dans les emplacements et les outils. Elle sert à identifier plus clairement ce qui est associé à un emplacement ou à un outil.',
          steps: [
            'Va dans Désignations.',
            'Consulte le nom de la désignation.',
            'Regarde le type associé.',
            'Utilise la vue liste ou images selon ton besoin.'
          ],
          relatedRoute: '/designations',
          relatedRouteLabel: 'Aller vers Désignations'
        },
        {
          id: 'designation-tool-diff',
          label: 'Quelle est la différence entre désignation et outil ?',
          answer: 'La désignation décrit un type ou une référence générale. L’outil représente un outillage réel, avec son code, son OTT, son client, son fournisseur et son emplacement.',
          steps: [
            'Utilise Désignations pour gérer les noms ou catégories.',
            'Utilise Outils pour gérer les outillages réels.',
            'Un outil peut être lié à une désignation via son emplacement.'
          ],
          relatedRoute: '/outils',
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
      route: '/lignes',
      questions: [
        {
          id: 'ligne-definition',
          label: 'C’est quoi une ligne ?',
          answer: 'Une ligne représente généralement une ligne de production, une zone ou une chaîne utilisée dans l’organisation de l’usine. Elle permet de rattacher les outils à un contexte de production.',
          steps: [
            'Va dans la page Lignes.',
            'Consulte les lignes existantes.',
            'Ajoute une nouvelle ligne si elle n’existe pas.',
            'Utilise le tri ou la recherche pour retrouver rapidement une ligne.'
          ],
          relatedRoute: '/lignes',
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
      route: '/clients',
      questions: [
        {
          id: 'client-fields',
          label: 'Quelle est la différence entre nom client, famille et référence ?',
          answer: 'Le nom client identifie le client principal. La famille peut représenter une catégorie ou famille de produit. La référence sert à distinguer une référence spécifique liée au client.',
          steps: [
            'Consulte la page Clients.',
            'Vérifie les colonnes nom client, famille et référence.',
            'Utilise ces informations pour retrouver les outils associés.'
          ],
          relatedRoute: '/clients',
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
      route: '/fournisseurs',
      questions: [
        {
          id: 'fournisseur-definition',
          label: 'Pourquoi un fournisseur est lié à un outil ?',
          answer: 'Le fournisseur permet de savoir d’où vient un outil ou quelle entité est associée à son approvisionnement. Cela facilite le suivi, la recherche et la réclamation en cas de problème.',
          steps: [
            'Va dans Fournisseurs.',
            'Vérifie le code fournisseur et le nom fournisseur.',
            'Consulte ensuite la page Outils pour voir les outils associés.'
          ],
          relatedRoute: '/fournisseurs',
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
      route: '/users',
      questions: [
        {
          id: 'roles-definition',
          label: 'Quelle est la différence entre ADMIN, RESPONSABLE et EMPLOYÉ ?',
          answer: 'ADMIN gère l’application et les données sensibles. RESPONSABLE traite ou suit certaines réclamations. EMPLOYÉ consulte les données autorisées et peut créer des réclamations selon les permissions.',
          steps: [
            'Va dans Utilisateurs inscrits.',
            'Regarde la colonne Rôle.',
            'Utilise le filtre par rôle.',
            'Les couleurs permettent de distinguer rapidement les rôles.'
          ],
          relatedRoute: '/users',
          relatedRouteLabel: 'Voir les utilisateurs'
        },
        {
          id: 'permission-hidden-button',
          label: 'Pourquoi certains boutons ne s’affichent pas ?',
          answer: 'Certains boutons dépendent du rôle de l’utilisateur connecté. Si un bouton n’apparaît pas, cela peut être une restriction d’accès et non un bug.',
          steps: [
            'Vérifie ton rôle dans ton profil.',
            'Compare avec les permissions attendues.',
            'Contacte un administrateur si tu penses qu’il y a une erreur.'
          ],
          relatedRoute: '/profile',
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
      route: '/emplacements',
      questions: [
        {
          id: 'emplacement-definition',
          label: 'C’est quoi un emplacement ?',
          answer: 'Un emplacement représente un endroit physique ou logique où un outil peut être rangé ou affecté. Il est souvent défini par une matière, une armoire, un numéro, une désignation et un statut.',
          steps: [
            'Va dans Emplacements.',
            'Regarde les colonnes matière, armoire, numéro et désignation.',
            'Vérifie le statut de chaque emplacement.',
            'Utilise les filtres pour rechercher rapidement.'
          ],
          relatedRoute: '/emplacements',
          relatedRouteLabel: 'Aller vers Emplacements'
        },
        {
          id: 'emplacement-status',
          label: 'Que signifient Libre, Occupé et HS ?',
          answer: 'Libre signifie disponible. Occupé signifie qu’un outil est affecté ou utilisé. HS signifie hors service, donc l’emplacement ne doit pas être utilisé sans vérification.',
          steps: [
            'Filtre les emplacements par statut.',
            'Vérifie les emplacements HS.',
            'Passe une réclamation si un problème est constaté.'
          ],
          relatedRoute: '/emplacements',
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
      route: '/matieres',
      questions: [
        {
          id: 'matiere-definition',
          label: 'C’est quoi une matière ?',
          answer: 'Une matière représente une matière utilisée dans les emplacements ou les outillages. Elle aide à organiser les données selon le type de matière ou le process associé.',
          steps: [
            'Va dans Matières.',
            'Consulte le nom de la matière.',
            'Regarde le process associé.',
            'Filtre par process si nécessaire.'
          ],
          relatedRoute: '/matieres',
          relatedRouteLabel: 'Aller vers Matières'
        },
        {
          id: 'matiere-process',
          label: 'Que signifient Pb et ROHS ?',
          answer: 'Pb fait généralement référence au plomb. ROHS désigne une conformité liée à la restriction de substances dangereuses. Ces process permettent de classer les matières selon leur contexte technique.',
          steps: [
            'Va dans Matières.',
            'Utilise le filtre Process.',
            'Choisis Pb ou ROHS selon le besoin.'
          ],
          relatedRoute: '/matieres',
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
      route: '/outils',
      questions: [
        {
          id: 'outil-definition',
          label: 'C’est quoi un outil dans iTools ?',
          answer: 'Un outil représente un outillage réel utilisé dans l’usine. Il peut être lié à une ligne, un client, un fournisseur, un emplacement, un OTT, un code outillage, un statut et une valeur de stock.',
          steps: [
            'Va dans la page Outils.',
            'Consulte les colonnes ligne, client et fournisseur.',
            'Vérifie l’emplacement associé.',
            'Regarde le statut et la valeur.'
          ],
          relatedRoute: '/outils',
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
          relatedRoute: '/outils',
          relatedRouteLabel: 'Rechercher un OTT'
        },
        {
          id: 'outil-stock',
          label: 'Que signifie stock normal, risque épuisement ou épuisé ?',
          answer: 'Stock normal signifie que la valeur est suffisante. Risque épuisement signifie que la valeur est basse. Épuisé signifie que la valeur est à zéro ou critique.',
          steps: [
            'Consulte la colonne Valeur.',
            'Regarde le badge de stock.',
            'Passe une réclamation si le stock est critique ou épuisé.'
          ],
          relatedRoute: '/outils',
          relatedRouteLabel: 'Vérifier les outils'
        },
        {
          id: 'outil-hs',
          label: 'Pourquoi une justification HS est obligatoire ?',
          answer: 'Quand un outil est hors service, il faut expliquer la raison du problème. Cela permet aux responsables ou administrateurs de comprendre pourquoi l’outil ne peut pas être utilisé.',
          steps: [
            'Choisis le statut HS.',
            'Renseigne la justification HS.',
            'Enregistre la modification.',
            'Passe une réclamation si une action est nécessaire.'
          ],
          relatedRoute: '/outils',
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
          answer: 'L’import en masse permet d’ajouter plusieurs lignes depuis un fichier Excel ou CSV. Il faut d’abord télécharger le modèle à remplir, compléter les colonnes, puis importer le fichier.',
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
            'Vérifie que les lignes, clients, fournisseurs ou emplacements existent déjà si nécessaire.',
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
      route: '/archives',
      questions: [
        {
          id: 'archives-role',
          label: 'À quoi sert l’historique ?',
          answer: 'L’historique permet de suivre les opérations réalisées dans l’application : connexions, modifications, suppressions, changements de profil et autres actions importantes.',
          steps: [
            'Va dans Historique.',
            'Utilise le calendrier pour sélectionner une date.',
            'Clique sur une date pour voir l’aperçu.',
            'Ouvre les détails pour consulter les anciennes et nouvelles valeurs.'
          ],
          relatedRoute: '/archives',
          relatedRouteLabel: 'Aller vers Historique'
        },
        {
          id: 'archives-json',
          label: 'Pourquoi certaines valeurs sont affichées en JSON ?',
          answer: 'Les anciennes et nouvelles valeurs sont parfois affichées sous forme JSON pour montrer précisément ce qui a changé dans les données.',
          steps: [
            'Ouvre les détails d’une date.',
            'Compare Anciennes valeurs et Nouvelles valeurs.',
            'Repère les champs modifiés.'
          ],
          relatedRoute: '/archives',
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
          answer: 'Cette erreur signifie souvent que le backend n’est pas lancé, que l’API n’est pas accessible ou que la base SQL Server n’est pas connectée.',
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
          relatedRoute: '/profile',
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
          relatedRoute: '/profile',
          relatedRouteLabel: 'Changer le mot de passe'
        }
      ]
    }
  ];

  constructor(private router: Router) {}

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

  get quickQuestions(): HelpQuestion[] {
    if (this.selectedTopic) {
      return this.selectedTopic.questions;
    }

    return this.topics.flatMap(topic => topic.questions).slice(0, 8);
  }

  selectTopic(topic: HelpTopic): void {
    this.selectedTopic = topic;
    this.selectedQuestion = null;

    this.messages.push({
      from: 'user',
      text: topic.title
    });

    this.messages.push({
      from: 'bot',
      text: `Très bien. Voici les questions disponibles pour la rubrique : ${topic.title}.`
    });

    this.scrollChatToBottom();
  }

  selectQuestion(question: HelpQuestion): void {
    this.selectedQuestion = question;

    this.messages.push({
      from: 'user',
      text: question.label
    });

    this.messages.push({
      from: 'bot',
      text: question.answer,
      question
    });

    this.scrollChatToBottom();
  }

  resetChat(): void {
    this.selectedTopic = null;
    this.selectedQuestion = null;
    this.searchText = '';

    this.messages = [
      {
        from: 'bot',
        text: 'Conversation réinitialisée. Choisis une rubrique ou une question pour commencer.'
      }
    ];

    this.scrollChatToBottom();
  }

  goToRoute(route?: string): void {
    if (!route) {
      return;
    }

    this.router.navigate([route]);
  }

  selectTopicById(topicId: string): void {
    const topic = this.topics.find(item => item.id === topicId);

    if (topic) {
      this.selectTopic(topic);
    }
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
    }, 50);
  }
}