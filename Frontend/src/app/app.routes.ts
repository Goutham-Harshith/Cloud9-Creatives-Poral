import { Routes } from '@angular/router';

import { adminGuard } from './core/auth/admin.guard';
import { authGuard } from './core/auth/auth.guard';
import { salesGuard } from './core/auth/sales.guard';
import { schedulerGuard } from './core/auth/scheduler.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((component) => component.Login),
    title: 'Sign in | Cloud9 Creatives',
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/app-layout/app-layout').then((component) => component.AppLayout),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((component) => component.Dashboard),
        title: 'Dashboard | Cloud9 Creatives',
      },
      {
        path: 'sales',
        loadComponent: () =>
          import('./features/sales/sales').then((component) => component.Sales),
        canActivate: [salesGuard],
        title: 'Sales | Cloud9 Creatives',
      },
      {
        path: 'scheduler',
        loadComponent: () =>
          import('./features/scheduler/scheduler').then((component) => component.Scheduler),
        canActivate: [schedulerGuard],
        title: 'Scheduler | Cloud9 Creatives',
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./features/admin/admin').then((component) => component.Admin),
        canActivate: [adminGuard],
        title: 'Admin | Cloud9 Creatives',
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports').then((component) => component.Reports),
        title: 'Reports | Cloud9 Creatives',
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
