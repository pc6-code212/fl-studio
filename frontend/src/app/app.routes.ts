import { Routes } from '@angular/router';
import { MainLayoutComponent } from '@layout/main-layout/main-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'studio' },
      {
        path: 'studio',
        loadChildren: () => import('@features/studio/studio.routes').then(m => m.STUDIO_ROUTES)
      }
    ]
  },
  { path: '**', redirectTo: 'studio' }
];
