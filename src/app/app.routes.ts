import { Routes } from '@angular/router';
import { HomePage } from './public/pages/home-page/home-page';
import { LoreEntryPage } from './public/pages/lore-entry-page/lore-entry-page';
import { loreEntryTitle } from './public/public-links';

export const routes: Routes = [
  {
    // `/` : couverture ; `/?chapitre=<id>` : grimoire ouvert sur un chapitre.
    path: '',
    component: HomePage,
    title: 'WriteMyLore'
  },
  {
    // Fiche publique (seules les fiches publiées sont affichées).
    path: 'lore/:id',
    component: LoreEntryPage,
    title: loreEntryTitle
  },
  {
    // Accès discret, non sécurisé : aucune authentification pour l'instant.
    path: 'admin',
    title: 'Dashboard Lore · WriteMyLore',
    loadComponent: () =>
      import('./admin/layout/admin-layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./admin/pages/dashboard-page/dashboard-page').then((m) => m.DashboardPage)
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
