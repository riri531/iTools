import { Routes } from '@angular/router';

import { LoginComponent } from './features/auth/login/login';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password';
import { ResetPasswordComponent } from './features/auth/reset-password/reset-password';

import { HomeComponent } from './features/home/home/home';
import { DashboardComponent } from './features/dashboard/dashboard/dashboard';

import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';

import { MainLayoutComponent } from './layout/main-layout/main-layout';

import { UsersComponent } from './features/users/users/users';
import { DesignationsComponent } from './features/designations/designations/designations';
import { LignesComponent } from './features/lignes/lignes/lignes';
import { ClientsComponent } from './features/clients/clients/clients';
import { FournisseursComponent } from './features/fournisseurs/fournisseurs/fournisseurs';
import { MatieresComponent } from './features/matieres/matieres/matieres';
import { EmplacementsComponent } from './features/emplacements/emplacements/emplacements';
import { OutilsComponent } from './features/outils/outils/outils';

import { ArchivesComponent } from './features/archives/archives/archives';
import { ArchiveDayComponent } from './features/archives/archive-day/archive-day';

import { ProfileComponent } from './features/profile/profile/profile';
import { NotificationsComponent } from './features/notifications/notifications/notifications';
import { ReclamationsComponent } from './features/reclamations/reclamations/reclamations';

import { AssistanceComponent } from './features/assistance/assistance/assistance';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  {
    path: 'login',
    component: LoginComponent
  },

  {
    path: 'forgot-password',
    component: ForgotPasswordComponent
  },

  {
    path: 'reset-password',
    component: ResetPasswordComponent
  },

  {
    path: 'home',
    component: HomeComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE'] }
  },

  {
    path: 'app',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },

      {
        path: 'dashboard',
        component: DashboardComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE'] }
      },

      {
        path: 'profile',
        component: ProfileComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE'] }
      },

      {
        path: 'notifications',
        component: NotificationsComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE'] }
      },

      {
        path: 'reclamations',
        component: ReclamationsComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE'] }
      },

      {
        path: 'assistance',
        component: AssistanceComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE'] }
      },

      {
        path: 'users',
        component: UsersComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'designations',
        component: DesignationsComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE'] }
      },

      {
        path: 'designations/:designationId/outils',
        component: OutilsComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE'] }
      },

      {
        path: 'lignes',
        component: LignesComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE'] }
      },

      {
        path: 'clients',
        component: ClientsComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RESPONSABLE'] }
      },

      {
        path: 'fournisseurs',
        component: FournisseursComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RESPONSABLE'] }
      },

      {
        path: 'matieres',
        component: MatieresComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE'] }
      },

      {
        path: 'emplacements',
        component: EmplacementsComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE'] }
      },

      {
        path: 'outils',
        component: OutilsComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'RESPONSABLE', 'EMPLOYE'] }
      },

      {
        path: 'archives',
        component: ArchivesComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      {
        path: 'archives/:date',
        component: ArchiveDayComponent,
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      }
    ]
  },

  {
    path: '**',
    redirectTo: 'login'
  }
];