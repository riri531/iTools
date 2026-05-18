import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { OutilsComponent } from './outils';

describe('OutilsComponent', () => {
  let component: OutilsComponent;
  let fixture: ComponentFixture<OutilsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        OutilsComponent,
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OutilsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});