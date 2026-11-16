import { Routes } from '@angular/router';

export const STUDIO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/studio.page').then(m => m.StudioPage)
  }
];
