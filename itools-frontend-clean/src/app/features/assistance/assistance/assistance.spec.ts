import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { AssistanceComponent } from './assistance';

describe('AssistanceComponent', () => {
  let component: AssistanceComponent;
  let fixture: ComponentFixture<AssistanceComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AssistanceComponent,
        RouterTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AssistanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});