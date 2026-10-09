/**
 * Illustration de la carte du monde, affichée en un seul morceau (Leaflet `ImageOverlay`).
 * Les dimensions sont celles du fichier : elles définissent les limites de la carte,
 * les proportions du cadre et la conversion des positions des lieux (pourcentages).
 */
export const WORLD_MAP_IMAGE = {
  /** Relatif au `<base href>` : servi depuis `public/`. */
  url: 'assets/images/Untitled.png',
  width: 2048,
  height: 1778,
} as const;
