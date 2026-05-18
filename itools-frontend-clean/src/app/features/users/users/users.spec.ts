import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsersComponent } from './users';
import { UserService } from '../../../core/services/user';

describe('UsersComponent', () => {
  let component: UsersComponent;
  let fixture: ComponentFixture<UsersComponent>;

  const userServiceMock = {
    getUsers: () => ({
      subscribe: (observer: any) => observer.next([])
    }),
    getRoles: () => ({
      subscribe: (observer: any) => observer.next([])
    }),
    importUsers: () => ({
      subscribe: (observer: any) => observer.next({})
    }),
    createUser: () => ({
      subscribe: (observer: any) => observer.next({})
    }),
    updateUser: () => ({
      subscribe: (observer: any) => observer.next({})
    }),
    deleteUser: () => ({
      subscribe: (observer: any) => observer.next({})
    })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersComponent],
      providers: [
        {
          provide: UserService,
          useValue: userServiceMock
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});