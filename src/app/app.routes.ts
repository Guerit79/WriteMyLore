import { Routes } from '@angular/router';
import { HomePage } from './public/pages/home-page/home-page';
import { LoreEntryPage } from './public/pages/lore-entry-page/lore-entry-page';
import { LoginPage } from './public/pages/login-page/login-page';
import { ProfilePage } from './public/pages/profile-page/profile-page';
import { RegisterPage } from './public/pages/register-page/register-page';
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
    // Carte du monde interactive : chargée à la demande (Leaflet n'alourdit pas l'accueil).
    path: 'carte',
    title: 'Carte du monde · WriteMyLore',
    loadComponent: () => import('./public/pages/map-page/map-page').then((m) => m.MapPage)
  },
  // Comptes en MODE DÉMONSTRATION : aucune authentification réelle ni protection de route.
  {
    path: 'connexion',
    component: LoginPage,
    title: 'Connexion · WriteMyLore'
  },
  {
    path: 'inscription',
    component: RegisterPage,
    title: 'Inscription · WriteMyLore'
  },
  {
    path: 'profil',
    component: ProfilePage,
    title: 'Profil · WriteMyLore'
  },
  {
    // Éditeur de carte : hors du layout d'administration, dans le même grimoire que la carte publique.
    // Déclaré avant `admin` pour ne pas être capté par ses routes enfants. Non sécurisé, comme `admin`.
    path: 'admin/carte',
    title: 'Éditeur de carte · WriteMyLore',
    loadComponent: () =>
      import('./admin/pages/map-editor-page/map-editor-page').then((m) => m.MapEditorPage)
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
