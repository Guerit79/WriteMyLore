import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { LocalStorageLoreRepository } from './core/data/local-storage-lore-repository';
import { LoreRepository } from './core/data/lore-repository';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Page unique sur téléphone : chaque navigation repart du haut, Retour retrouve la position.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })
    ),
    // Stockage du Lore : à remplacer par une implémentation HTTP quand le backend sera prêt.
    { provide: LoreRepository, useClass: LocalStorageLoreRepository }
  ]
};
