import { Params } from '@angular/router';
import {
  LORE_CATEGORIES,
  LoreCategory,
  LoreEntry,
  LoreEntryId,
  LoreEntryType,
  LoreRelation,
  LoreRelationType,
} from '../models/lore';

/**
 * Règles du fil d'Ariane : seules ces combinaisons (type de relation + type de la fiche source)
 * forment une hiérarchie. Toutes les autres relations sont simplement « associées ».
 */
export interface HierarchicalRelationRule {
  relationType: LoreRelationType;
  sourceTypes: readonly LoreEntryType[];
}

export const HIERARCHICAL_RELATION_RULES: readonly HierarchicalRelationRule[] = [
  { relationType: 'se trouve dans', sourceTypes: ['Géographie', 'Continent', 'Royaume', 'Région', 'Lieu'] },
  { relationType: 'appartient à', sourceTypes: ['Race', 'Faction', 'Clan', 'Personnage'] },
];

export function isHierarchicalRelation(
  sourceType: LoreEntryType,
  relationType: LoreRelationType,
): boolean {
  return HIERARCHICAL_RELATION_RULES.some(
    (rule) => rule.relationType === relationType && rule.sourceTypes.includes(sourceType),
  );
}

export type LoreEntryLookup = ReadonlyMap<LoreEntryId, LoreEntry>;

export function indexEntries(entries: readonly LoreEntry[]): LoreEntryLookup {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

/** Premier parent hiérarchique existant de la fiche, s'il y en a un. */
export function findHierarchicalParent(
  entry: LoreEntry,
  lookup: LoreEntryLookup,
): LoreEntry | undefined {
  for (const relation of entry.relations) {
    if (!isHierarchicalRelation(entry.type, relation.type)) {
      continue;
    }
    const parent = lookup.get(relation.targetId);
    if (parent) {
      return parent;
    }
  }
  return undefined;
}

/**
 * Fil d'Ariane du plus lointain ancêtre jusqu'à la fiche elle-même.
 * Seules les relations hiérarchiques sont suivies ; les cycles éventuels sont ignorés.
 */
export function buildBreadcrumb(entry: LoreEntry, lookup: LoreEntryLookup): LoreEntry[] {
  const trail = [entry];
  const visited = new Set<LoreEntryId>([entry.id]);
  let parent = findHierarchicalParent(entry, lookup);

  while (parent && !visited.has(parent.id)) {
    trail.unshift(parent);
    visited.add(parent.id);
    parent = findHierarchicalParent(parent, lookup);
  }

  return trail;
}

export type LoreRelationDirection = 'outgoing' | 'incoming';

/** Relation vue depuis une fiche donnée, prête à être affichée comme lien. */
export interface LoreRelationLink {
  relation: LoreRelation;
  direction: LoreRelationDirection;
  /** La fiche située à l'autre bout de la relation. */
  other: LoreEntry;
  hierarchical: boolean;
}

/** Relations sortantes puis entrantes d'une fiche (les fiches introuvables sont ignorées). */
export function getRelationLinks(
  entry: LoreEntry,
  entries: readonly LoreEntry[],
  lookup: LoreEntryLookup,
): LoreRelationLink[] {
  const outgoing: LoreRelationLink[] = [];
  for (const relation of entry.relations) {
    const other = lookup.get(relation.targetId);
    if (other) {
      outgoing.push({
        relation,
        direction: 'outgoing',
        other,
        hierarchical: isHierarchicalRelation(entry.type, relation.type),
      });
    }
  }

  const incoming: LoreRelationLink[] = [];
  for (const other of entries) {
    if (other.id === entry.id) {
      continue;
    }
    for (const relation of other.relations) {
      if (relation.targetId === entry.id) {
        incoming.push({
          relation,
          direction: 'incoming',
          other,
          hierarchical: isHierarchicalRelation(other.type, relation.type),
        });
      }
    }
  }

  return [...outgoing, ...incoming];
}

/** Relation résolue avec ses deux fiches, pour les listes globales. */
export interface LoreRelationView {
  relation: LoreRelation;
  source: LoreEntry;
  target: LoreEntry;
  hierarchical: boolean;
}

export function listRelations(
  entries: readonly LoreEntry[],
  lookup: LoreEntryLookup,
): LoreRelationView[] {
  const views: LoreRelationView[] = [];
  for (const source of entries) {
    for (const relation of source.relations) {
      const target = lookup.get(relation.targetId);
      if (target) {
        views.push({
          relation,
          source,
          target,
          hierarchical: isHierarchicalRelation(source.type, relation.type),
        });
      }
    }
  }
  return views;
}

/** Destination d'un lien vers une fiche, compatible avec `routerLink` et `queryParams`. */
export interface LoreLinkTarget {
  commands: string | readonly unknown[];
  queryParams?: Params;
}

/**
 * Construit le lien vers une fiche. Chaque contexte fournit le sien :
 * l'administration ouvre l'éditeur, la future page publique ouvrira la fiche détaillée.
 */
export type LoreLinkBuilder = (entry: LoreEntry) => LoreLinkTarget;

/** Catégorie publique d'un type de fiche (`undefined` pour « Monde », qui chapeaute tout). */
export function findCategoryForType(type: LoreEntryType): LoreCategory | undefined {
  return LORE_CATEGORIES.find((category) => category.types.includes(type));
}
