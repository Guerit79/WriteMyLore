/**
 * Modèle du Lore : fiches (éléments de l'univers) et relations entre fiches.
 * Ces types décrivent aussi le contrat attendu du futur backend Spring Boot.
 */

export const LORE_ENTRY_TYPES = [
  'Monde',
  'Géographie',
  'Continent',
  'Royaume',
  'Région',
  'Lieu',
  'Race',
  'Culture',
  'Faction',
  'Clan',
  'Personnage',
  'Événement',
  'Objet',
  'Histoire',
] as const;

export type LoreEntryType = (typeof LORE_ENTRY_TYPES)[number];

export const LORE_ENTRY_STATUSES = ['Brouillon', 'Publié'] as const;

export type LoreEntryStatus = (typeof LORE_ENTRY_STATUSES)[number];

export const LORE_RELATION_TYPES = [
  'appartient à',
  'se trouve dans',
  'dirige',
  'possède',
  'participe à',
  'est lié à',
] as const;

export type LoreRelationType = (typeof LORE_RELATION_TYPES)[number];

/** Identifiant stable d'une fiche (UUID généré côté client pour l'instant, fourni par l'API plus tard). */
export type LoreEntryId = string;

export interface LoreRelation {
  id: string;
  sourceId: LoreEntryId;
  type: LoreRelationType;
  targetId: LoreEntryId;
}

export interface LoreEntry {
  id: LoreEntryId;
  name: string;
  type: LoreEntryType;
  summary: string;
  content: string;
  status: LoreEntryStatus;
  /** Relations sortantes : cette fiche en est toujours la source. */
  relations: readonly LoreRelation[];
  /** Dates ISO 8601. */
  createdAt: string;
  updatedAt: string;
}

/** Champs éditables d'une fiche (corps d'un futur POST / PUT). */
export type LoreEntryInput = Pick<LoreEntry, 'name' | 'type' | 'summary' | 'content' | 'status'>;

/** Données nécessaires pour créer une relation depuis une fiche source. */
export type LoreRelationInput = Pick<LoreRelation, 'type' | 'targetId'>;

/** Grandes catégories affichées depuis la page « Monde ». */
export interface LoreCategory {
  id: string;
  label: string;
  types: readonly LoreEntryType[];
}

export const LORE_CATEGORIES: readonly LoreCategory[] = [
  { id: 'geographie', label: 'Géographie', types: ['Géographie', 'Continent', 'Royaume', 'Région', 'Lieu'] },
  { id: 'peuples', label: 'Peuples et races', types: ['Race', 'Culture'] },
  { id: 'factions', label: 'Factions', types: ['Faction', 'Clan'] },
  { id: 'histoire', label: 'Histoire', types: ['Événement', 'Histoire'] },
  { id: 'personnages', label: 'Personnages', types: ['Personnage'] },
  { id: 'objets', label: 'Objets', types: ['Objet'] },
];
