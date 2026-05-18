import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { EmplacementsComponent } from './emplacements';

describe('EmplacementsComponent', () => {
  let component: EmplacementsComponent;
  let fixture: ComponentFixture<EmplacementsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        EmplacementsComponent,
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EmplacementsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});