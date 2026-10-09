/**
 * Frontières de royaumes : polygones dessinés au-dessus de l'illustration de la carte,
 * dans un calque distinct des lieux. Ces types décrivent aussi le contrat d'une future API.
 */
import { LoreEntryId } from './lore';

/**
 * Sommet d'une frontière, normalisé par rapport à l'image : x et y entre 0 et 1
 * (0 = bord gauche / haut, 1 = bord droit / bas). Indépendant de la taille d'affichage.
 */
export interface MapPoint {
  x: number;
  y: number;
}

export const BORDER_STROKE_STYLES = [
  { id: 'plein', label: 'Plein' },
  { id: 'pointille', label: 'Pointillé' },
] as const;

export type BorderStrokeStyle = (typeof BORDER_STROKE_STYLES)[number]['id'];

/** Limites des réglages (formulaire et relecture des données). */
export const BORDER_STROKE_WIDTH = { min: 1, max: 8 } as const;
export const BORDER_FILL_OPACITY = { min: 0, max: 0.6 } as const;
/** Un polygone fermé compte au moins trois sommets. */
export const BORDER_MIN_POINTS = 3;

/** Couleurs proposées pour un nouveau royaume (encres héraldiques lisibles sur la carte). */
export const BORDER_COLORS = ['#8b1e1e', '#24485a', '#2f5a2a', '#5a3d6b', '#9b6b1e', '#3e3a48'] as const;

export interface MapBorder {
  id: string;
  /** Nom du royaume, affiché sur la carte. */
  name: string;
  /** Fiche du Lore du royaume (facultative). */
  loreEntryId: LoreEntryId | null;
  /** Couleur CSS hexadécimale (#rrggbb). */
  color: string;
  /** Opacité du remplissage, de 0 (transparent) à BORDER_FILL_OPACITY.max. */
  fillOpacity: number;
  strokeStyle: BorderStrokeStyle;
  /** Épaisseur du contour, en pixels d'écran (constante quel que soit le zoom). */
  strokeWidth: number;
  /** Frontière affichée (si désactivée, elle reste dans l'éditeur mais n'apparaît nulle part ailleurs). */
  visible: boolean;
  /** Frontière rendue publique : affichée sur la carte publique (si elle est aussi visible). */
  isPublic: boolean;
  /** Sommets du polygone, dans l'ordre du tracé (fermeture implicite). */
  points: readonly MapPoint[];
}

/** Réglages globaux du calque des frontières. */
export interface MapBorderSettings {
  /** Interrupteur général : afficher les frontières sur la carte publique. */
  showOnPublicMap: boolean;
}

export const DEFAULT_BORDER_SETTINGS: MapBorderSettings = { showOnPublicMap: true };

/** Frontières affichées sur la carte publique, selon les réglages. */
export function publicBorders(
  borders: readonly MapBorder[],
  settings: MapBorderSettings,
): MapBorder[] {
  return settings.showOnPublicMap
    ? borders.filter(
        (border) => border.visible && border.isPublic && border.points.length >= BORDER_MIN_POINTS,
      )
    : [];
}
