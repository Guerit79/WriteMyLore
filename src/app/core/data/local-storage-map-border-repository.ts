import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  BORDER_COLORS,
  BORDER_FILL_OPACITY,
  BORDER_STROKE_STYLES,
  BORDER_STROKE_WIDTH,
  BorderStrokeStyle,
  DEFAULT_BORDER_SETTINGS,
  MapBorder,
  MapBorderSettings,
  MapPoint,
} from '../models/map-border';
import { MapBorderRepository } from './map-border-repository';

export const BORDER_STORAGE_KEY = 'writemylore.map-borders.v1';
const STORAGE_VERSION = 1;

interface StoredBorders {
  version: number;
  borders: unknown[];
  settings: unknown;
}

/**
 * Stockage local (prototype) des frontières et de leurs réglages, dans `localStorage`.
 * Aucune frontière au départ. Les données sont relues avec tolérance (`normalizeBorder`).
 */
@Injectable()
export class LocalStorageMapBorderRepository extends MapBorderRepository {
  private state = this.read();

  findAll(): Observable<MapBorder[]> {
    return of(structuredClone(this.state.borders));
  }

  save(border: MapBorder): Observable<MapBorder[]> {
    const saved = normalizeBorder(border);
    if (!saved) {
      return throwError(() => new Error('La frontière est incomplète.'));
    }
    const exists = this.state.borders.some((item) => item.id === saved.id);
    this.state.borders = exists
      ? this.state.borders.map((item) => (item.id === saved.id ? saved : item))
      : [...this.state.borders, saved];
    this.write();
    return of(structuredClone(this.state.borders));
  }

  delete(id: string): Observable<MapBorder[]> {
    if (!this.state.borders.some((border) => border.id === id)) {
      return throwError(() => new Error('Frontière introuvable.'));
    }
    this.state.borders = this.state.borders.filter((border) => border.id !== id);
    this.write();
    return of(structuredClone(this.state.borders));
  }

  getSettings(): Observable<MapBorderSettings> {
    return of({ ...this.state.settings });
  }

  saveSettings(settings: MapBorderSettings): Observable<MapBorderSettings> {
    this.state.settings = normalizeSettings(settings);
    this.write();
    return of({ ...this.state.settings });
  }

  private read(): { borders: MapBorder[]; settings: MapBorderSettings } {
    try {
      const raw = localStorage.getItem(BORDER_STORAGE_KEY);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (isRecord(parsed) && Array.isArray(parsed['borders'])) {
          return {
            borders: parsed['borders'].map(normalizeBorder).filter((border) => border !== null),
            settings: normalizeSettings(parsed['settings']),
          };
        }
      }
    } catch {
      // Stockage indisponible ou contenu corrompu : aucune frontière.
    }
    return { borders: [], settings: { ...DEFAULT_BORDER_SETTINGS } };
  }

  private write(): void {
    try {
      const stored: StoredBorders = { version: STORAGE_VERSION, ...this.state };
      localStorage.setItem(BORDER_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Stockage indisponible (navigation privée, quota…) : les données restent en mémoire.
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function normalizePoint(value: unknown): MapPoint | null {
  if (!isRecord(value) || typeof value['x'] !== 'number' || typeof value['y'] !== 'number') {
    return null;
  }
  if (!Number.isFinite(value['x']) || !Number.isFinite(value['y'])) {
    return null;
  }
  return { x: clamp(value['x'], 0, 1, 0), y: clamp(value['y'], 0, 1, 0) };
}

function normalizeSettings(value: unknown): MapBorderSettings {
  return {
    showOnPublicMap:
      isRecord(value) && typeof value['showOnPublicMap'] === 'boolean'
        ? value['showOnPublicMap']
        : DEFAULT_BORDER_SETTINGS.showOnPublicMap,
  };
}

/**
 * Frontière valide à partir d'une donnée enregistrée, `null` si elle est inutilisable.
 * Les réglages manquants ou hors limites reçoivent une valeur par défaut ; les sommets
 * invalides sont ignorés (un tracé de moins de trois sommets est conservé comme brouillon).
 */
export function normalizeBorder(value: unknown): MapBorder | null {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['name'] !== 'string') {
    return null;
  }
  const name = value['name'].trim();
  if (value['id'].trim() === '' || name === '') {
    return null;
  }
  const color =
    typeof value['color'] === 'string' && /^#[0-9a-f]{6}$/i.test(value['color'])
      ? value['color'].toLowerCase()
      : BORDER_COLORS[0];
  const strokeStyle: BorderStrokeStyle = BORDER_STROKE_STYLES.some((style) => style.id === value['strokeStyle'])
    ? (value['strokeStyle'] as BorderStrokeStyle)
    : 'plein';
  const points = Array.isArray(value['points'])
    ? value['points'].map(normalizePoint).filter((point) => point !== null)
    : [];

  return {
    id: value['id'],
    name,
    loreEntryId: typeof value['loreEntryId'] === 'string' && value['loreEntryId'] ? value['loreEntryId'] : null,
    color,
    fillOpacity: clamp(value['fillOpacity'], BORDER_FILL_OPACITY.min, BORDER_FILL_OPACITY.max, 0.15),
    strokeStyle,
    strokeWidth: Math.round(clamp(value['strokeWidth'], BORDER_STROKE_WIDTH.min, BORDER_STROKE_WIDTH.max, 3)),
    visible: value['visible'] !== false,
    isPublic: value['isPublic'] === true,
    points,
  };
}
