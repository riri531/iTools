import { TestBed } from '@angular/core/testing';

import { Designation } from './designation';

describe('Designation', () => {
  let service: Designation;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Designation);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
