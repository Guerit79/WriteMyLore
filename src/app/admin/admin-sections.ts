import { Params } from '@angular/router';
import { LoreLinkBuilder } from '../core/lore/lore-navigation';

export type AdminSectionId = 'apercu' | 'fiches' | 'relations';

export interface AdminSection {
  id: AdminSectionId;
  label: string;
  icon: string;
  queryParams: Params;
}

/** Sections du Dashboard, sélectionnées par le paramètre `?section=` de la route `/admin`. */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { id: 'apercu', label: 'Vue d’ensemble', icon: '◈', queryParams: {} },
  { id: 'fiches', label: 'Fiches du Lore', icon: '❦', queryParams: { section: 'fiches' } },
  { id: 'relations', label: 'Relations', icon: '⚭', queryParams: { section: 'relations' } },
];

/** Valeur du paramètre `fiche` pour ouvrir le formulaire de création. */
export const NEW_ENTRY_PARAM = 'nouvelle';

export function toAdminSection(value: string | null | undefined): AdminSectionId {
  return ADMIN_SECTIONS.find((section) => section.id === value)?.id ?? 'apercu';
}

/** Lien d'administration vers une fiche : ouvre son éditeur dans la section « Fiches du Lore ». */
export const adminEntryLink: LoreLinkBuilder = (entry) => ({
  commands: ['/admin'],
  queryParams: { section: 'fiches', fiche: entry.id },
});
