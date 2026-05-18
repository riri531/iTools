import { TestBed } from '@angular/core/testing';

import { Matiere } from './matiere';

describe('Matiere', () => {
  let service: Matiere;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Matiere);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
