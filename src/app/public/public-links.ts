import { inject } from '@angular/core';
import { Params, ResolveFn } from '@angular/router';
import { LoreLinkBuilder } from '../core/lore/lore-navigation';
import { LoreStore } from '../core/services/lore-store';

/** Chapitre ouvert par défaut quand le grimoire est ouvert. */
export const HOME_CHAPTER = 'accueil';

/** Lien public vers une fiche : `/lore/:id`. */
export const publicEntryLink: LoreLinkBuilder = (entry) => ({ commands: ['/lore', entry.id] });

/** Paramètres d'URL d'un chapitre du grimoire : `/?chapitre=<id>`. */
export function chapterQueryParams(chapter: string): Params {
  return { chapitre: chapter };
}

/** Titre de l'onglet du navigateur pour `/lore/:id` (sans révéler l'existence d'un brouillon). */
export const loreEntryTitle: ResolveFn<string> = (route) => {
  const entry = inject(LoreStore).findPublished(route.paramMap.get('id') ?? '');
  return entry ? `${entry.name} · WriteMyLore` : 'Fiche introuvable · WriteMyLore';
};
