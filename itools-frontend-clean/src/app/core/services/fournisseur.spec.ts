import { TestBed } from '@angular/core/testing';

import { Fournisseur } from './fournisseur';

describe('Fournisseur', () => {
  let service: Fournisseur;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Fournisseur);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
