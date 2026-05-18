import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { DesignationsComponent } from './designations';

describe('DesignationsComponent', () => {
  let component: DesignationsComponent;
  let fixture: ComponentFixture<DesignationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DesignationsComponent,
        HttpClientTestingModule
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DesignationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});