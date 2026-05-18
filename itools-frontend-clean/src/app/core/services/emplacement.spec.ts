import { TestBed } from '@angular/core/testing';

import { Emplacement } from './emplacement';

describe('Emplacement', () => {
  let service: Emplacement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Emplacement);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
