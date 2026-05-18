import { TestBed } from '@angular/core/testing';

import { Outil } from './outil';

describe('Outil', () => {
  let service: Outil;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Outil);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
