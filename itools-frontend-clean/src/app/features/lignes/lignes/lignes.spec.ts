import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { LignesComponent } from './lignes';

describe('LignesComponent', () => {
  let component: LignesComponent;
  let fixture: ComponentFixture<LignesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        LignesComponent,
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LignesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});