import { TestBed } from '@angular/core/testing';

import { Ligne } from './ligne';

describe('Ligne', () => {
  let service: Ligne;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Ligne);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
