import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

export interface GlobalSearchResult {
  type: string;
  label: string;
  description: string;
  route: string;
  icon: string;
}

interface SearchSource {
  type: string;
  endpoint: string;
  route: string;
  icon: string;
  labelFields: string[];
  descriptionFields: string[];
}

@Injectable({
  providedIn: 'root'
})
export class GlobalSearchService {
  private http = inject(HttpClient);

  private readonly apiUrl = 'http://localhost:5160';

  private readonly sources: SearchSource[] = [
    {
      type: 'Outil',
      endpoint: '/outils',
      route: '/app/outils',
      icon: '/icons/outils.png',
      labelFields: ['nom', 'name', 'code', 'reference', 'ref', 'libelle', 'designation'],
      descriptionFields: ['description', 'etat', 'status', 'emplacement', 'emplacementNom', 'designationNom']
    },
    {
      type: 'Emplacement',
      endpoint: '/emplacements',
      route: '/app/emplacements',
      icon: '/icons/emplacement.png',
      labelFields: ['nom', 'name', 'code', 'reference', 'ref', 'libelle'],
      descriptionFields: ['description', 'etat', 'status', 'type', 'zone']
    },
    {
      type: 'Fournisseur',
      endpoint: '/fournisseurs',
      route: '/app/fournisseurs',
      icon: '/icons/fournisseurs.png',
      labelFields: ['nom', 'name', 'raisonSociale', 'libelle'],
      descriptionFields: ['email', 'telephone', 'phone', 'adresse', 'address']
    },
    {
      type: 'Client',
      endpoint: '/clients',
      route: '/app/clients',
      icon: '/icons/clients.png',
      labelFields: ['nom', 'name', 'raisonSociale', 'libelle'],
      descriptionFields: ['email', 'telephone', 'phone', 'adresse', 'address']
    },
    {
      type: 'Ligne',
      endpoint: '/lignes',
      route: '/app/lignes',
      icon: '/icons/lignes.png',
      labelFields: ['nom', 'name', 'code', 'reference', 'ref', 'libelle'],
      descriptionFields: ['description']
    },
    {
      type: 'Désignation',
      endpoint: '/designations',
      route: '/app/designations',
      icon: '/icons/designation.png',
      labelFields: ['nom', 'name', 'libelle', 'label', 'code', 'reference'],
      descriptionFields: ['description']
    },
    {
      type: 'Matière',
      endpoint: '/matieres',
      route: '/app/matieres',
      icon: '/icons/designation.png',
      labelFields: ['nom', 'name', 'libelle', 'label', 'code', 'reference'],
      descriptionFields: ['description']
    },
    {
      type: 'Utilisateur',
      endpoint: '/users',
      route: '/app/users',
      icon: '/icons/utilisateur.png',
      labelFields: ['fullName', 'name', 'nom', 'prenom', 'email'],
      descriptionFields: ['role', 'email']
    }
  ];

  search(keyword: string): Observable<GlobalSearchResult[]> {
    const q = this.normalizeText(keyword);

    if (!q) {
      return of([]);
    }

    const requests: Record<string, Observable<any>> = {};

    for (const source of this.sources) {
      requests[source.type] = this.safeGet(source.endpoint);
    }

    return forkJoin(requests).pipe(
      map(responses => {
        const results: GlobalSearchResult[] = [];

        for (const source of this.sources) {
          const response = responses[source.type];
          const items = this.extractArray(response);

          for (const item of items) {
            const searchableText = this.normalizeText(this.objectToSearchableText(item));

            if (searchableText.includes(q)) {
              results.push({
                type: source.type,
                label: this.getFirstValue(item, source.labelFields) || source.type,
                description:
                  this.getFirstValue(item, source.descriptionFields) ||
                  `Résultat trouvé dans ${source.type.toLowerCase()}`,
                route: `${source.route}?q=${encodeURIComponent(keyword)}`,
                icon: source.icon
              });
            }
          }
        }

        return results.slice(0, 30);
      })
    );
  }

  private safeGet(endpoint: string): Observable<any> {
    return this.http.get(`${this.apiUrl}${endpoint}`).pipe(
      catchError(error => {
        console.error(`Recherche globale - erreur endpoint ${endpoint}`, error);
        return of([]);
      })
    );
  }

  private extractArray(response: any): any[] {
    if (!response) {
      return [];
    }

    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response.$values)) {
      return response.$values;
    }

    if (Array.isArray(response.data)) {
      return response.data;
    }

    if (Array.isArray(response.items)) {
      return response.items;
    }

    if (Array.isArray(response.results)) {
      return response.results;
    }

    if (Array.isArray(response.result)) {
      return response.result;
    }

    if (Array.isArray(response.content)) {
      return response.content;
    }

    return [];
  }

  private objectToSearchableText(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.objectToSearchableText(item)).join(' ');
    }

    if (typeof value === 'object') {
      return Object.values(value)
        .map(item => this.objectToSearchableText(item))
        .join(' ');
    }

    return '';
  }

  private getFirstValue(item: any, fields: string[]): string {
    for (const field of fields) {
      const value = item?.[field];

      if (value !== null && value !== undefined && String(value).trim() !== '') {
        return String(value);
      }
    }

    return '';
  }

  private normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
}