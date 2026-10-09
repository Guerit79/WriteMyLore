/**
 * Modèle de la carte du monde : hiérarchie géographique et lieux (points) placés sur l'illustration.
 * La carte est une image (pas de coordonnées GPS) : les positions sont des pourcentages de l'image.
 * Ces types décrivent aussi le contrat attendu d'une future API.
 */
import { LoreEntryId } from './lore';

/** Niveaux de la hiérarchie, du plus large au plus précis (les lieux sont sous les zones). */
export const GEO_LEVELS = ['Continent', 'Royaume', 'Région', 'Zone'] as const;

export type GeoLevel = (typeof GEO_LEVELS)[number];

export interface GeoNode {
  id: string;
  name: string;
  level: GeoLevel;
  /** Parent direct (absent pour un continent). */
  parentId?: string;
}

/** Définition d'un type de point : libellé, symbole du marqueur et couleur. */
export interface MapPlaceTypeDefinition {
  id: string;
  label: string;
  /** Symbole Unicode (suivi de U+FE0E : rendu texte, jamais emoji). */
  glyph: string;
  color: string;
}

/**
 * Registre des types de points : seule source des libellés, symboles et couleurs
 * (marqueurs, filtres, formulaire). Pour ajouter un type, ajouter une ligne ici.
 * Les identifiants existants ne doivent pas changer : ils sont enregistrés avec les points.
 */
export const MAP_PLACE_TYPE_DEFINITIONS = [
  { id: 'capitale', label: 'Capitale', glyph: '♛︎', color: '#8b1e1e' },
  { id: 'ville', label: 'Ville', glyph: '⌂︎', color: '#7a4a12' },
  { id: 'village', label: 'Village', glyph: '△︎', color: '#8a6a2a' },
  { id: 'fort', label: 'Fort', glyph: '♜︎', color: '#3e3a48' },
  { id: 'donjon', label: 'Donjon', glyph: '⚔︎', color: '#4a1f1f' },
  { id: 'ruine', label: 'Ruine', glyph: '⚱︎', color: '#5a3d6b' },
  { id: 'grotte', label: 'Grotte', glyph: '◓︎', color: '#24485a' },
  { id: 'foret', label: 'Forêt', glyph: '♣︎', color: '#2f5a2a' },
  { id: 'region', label: 'Région ou zone', glyph: '◎︎', color: '#2a5a6a' },
  { id: 'autre', label: 'Autre', glyph: '✦︎', color: '#6b5034' },
] as const satisfies readonly MapPlaceTypeDefinition[];

export type MapPlaceType = (typeof MAP_PLACE_TYPE_DEFINITIONS)[number]['id'];

export const MAP_PLACE_TYPES: readonly MapPlaceType[] = MAP_PLACE_TYPE_DEFINITIONS.map(
  (definition) => definition.id,
);

/** Type attribué à un point dont le type est inconnu (donnée ancienne ou corrompue). */
export const DEFAULT_MAP_PLACE_TYPE: MapPlaceType = 'autre';

const TYPE_INDEX = new Map<string, MapPlaceTypeDefinition>(
  MAP_PLACE_TYPE_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function isMapPlaceType(value: unknown): value is MapPlaceType {
  return typeof value === 'string' && TYPE_INDEX.has(value);
}

/** Définition d'un type (celle de « Autre » si le type est inconnu). */
export function mapPlaceType(type: string): MapPlaceTypeDefinition {
  return TYPE_INDEX.get(type) ?? TYPE_INDEX.get(DEFAULT_MAP_PLACE_TYPE)!;
}

/** Position sur l'image, en pourcentage (0 = bord gauche / haut, 100 = bord droit / bas). */
export interface MapPosition {
  x: number;
  y: number;
}

/**
 * Point de la carte.
 * Association avec les fiches : un point regroupe zéro, une ou plusieurs fiches ; une fiche est
 * liée à au plus un point (l'unicité est garantie à l'enregistrement). Une fiche sans point
 * n'apparaît simplement pas sur la carte.
 */
export interface MapPlace {
  id: string;
  name: string;
  type: MapPlaceType;
  position: MapPosition;
  description: string;
  /** Zone de la hiérarchie Continent → Royaume → Région → Zone (facultative). */
  zoneId: string | null;
  /** Fiches du Lore associées à ce point. */
  loreEntryIds: readonly LoreEntryId[];
  /** Point d'exemple fourni avec le prototype. */
  demo?: boolean;
}
