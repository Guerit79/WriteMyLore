import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { DEMO_MAP_PLACES } from '../map/world-map-demo-data';
import { DEFAULT_MAP_PLACE_TYPE, MapPlace, isMapPlaceType } from '../models/world-map';
import { WorldMapRepository } from './world-map-repository';

export const MAP_STORAGE_KEY = 'writemylore.map.v1';
const STORAGE_VERSION = 1;

interface StoredMap {
  version: number;
  places: unknown[];
}

/**
 * Stockage local (prototype) : les points sont gardés en mémoire et recopiés dans `localStorage`.
 * Au premier chargement (rien d'enregistré), les points de démonstration servent de départ.
 * Les données sont relues avec tolérance (`normalizePlace`) : un ancien format ou un champ
 * manquant est converti plutôt que perdu.
 */
@Injectable()
export class LocalStorageWorldMapRepository extends WorldMapRepository {
  private places: MapPlace[] = this.read();

  findAll(): Observable<MapPlace[]> {
    return of(structuredClone(this.places));
  }

  save(place: MapPlace): Observable<MapPlace[]> {
    const saved = normalizePlace(place);
    if (!saved) {
      return throwError(() => new Error('Le point est incomplet.'));
    }
    const linked = new Set(saved.loreEntryIds);
    // Une fiche n'appartient qu'à un point : elle quitte son ancien point.
    const unlink = (item: MapPlace): MapPlace =>
      item.loreEntryIds.some((id) => linked.has(id))
        ? { ...item, loreEntryIds: item.loreEntryIds.filter((id) => !linked.has(id)) }
        : item;
    const exists = this.places.some((item) => item.id === saved.id);
    const updated = this.places.map((item) => (item.id === saved.id ? saved : unlink(item)));
    this.places = exists ? updated : [...updated, saved];
    this.write();
    return of(structuredClone(this.places));
  }

  delete(id: string): Observable<MapPlace[]> {
    if (!this.places.some((place) => place.id === id)) {
      return throwError(() => new Error('Point introuvable.'));
    }
    this.places = this.places.filter((place) => place.id !== id);
    this.write();
    return of(structuredClone(this.places));
  }

  private read(): MapPlace[] {
    try {
      const raw = localStorage.getItem(MAP_STORAGE_KEY);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        // Format actuel { version, places } ou ancien tableau de points.
        const items = isStoredMap(parsed) ? parsed.places : Array.isArray(parsed) ? parsed : null;
        if (items) {
          return dedupeLinks(items.map(normalizePlace).filter((place) => place !== null));
        }
      }
    } catch {
      // Stockage indisponible ou contenu corrompu : on repart des points de démonstration.
    }
    return structuredClone(DEMO_MAP_PLACES) as MapPlace[];
  }

  private write(): void {
    try {
      const stored: StoredMap = { version: STORAGE_VERSION, places: this.places };
      localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Stockage indisponible (navigation privée, quota…) : les données restent en mémoire.
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStoredMap(value: unknown): value is StoredMap {
  return isRecord(value) && typeof value['version'] === 'number' && Array.isArray(value['places']);
}

function toPercent(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
}

/**
 * Point valide à partir d'une donnée enregistrée, `null` si elle est inutilisable.
 * Compatibilité : l'ancien champ `loreEntryId` (une seule fiche) devient `loreEntryIds`,
 * un type inconnu devient « Autre », une zone absente devient `null`.
 */
export function normalizePlace(value: unknown): MapPlace | null {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['name'] !== 'string') {
    return null;
  }
  const position = value['position'];
  const x = isRecord(position) ? toPercent(position['x']) : null;
  const y = isRecord(position) ? toPercent(position['y']) : null;
  if (x === null || y === null || value['id'].trim() === '' || value['name'].trim() === '') {
    return null;
  }

  const ids = Array.isArray(value['loreEntryIds'])
    ? value['loreEntryIds']
    : typeof value['loreEntryId'] === 'string'
      ? [value['loreEntryId']]
      : [];
  const loreEntryIds = [...new Set(ids.filter((id): id is string => typeof id === 'string'))];

  const place: MapPlace = {
    id: value['id'],
    name: value['name'].trim(),
    type: isMapPlaceType(value['type']) ? value['type'] : DEFAULT_MAP_PLACE_TYPE,
    position: { x, y },
    description: typeof value['description'] === 'string' ? value['description'].trim() : '',
    zoneId: typeof value['zoneId'] === 'string' && value['zoneId'] !== '' ? value['zoneId'] : null,
    loreEntryIds,
  };
  return value['demo'] === true ? { ...place, demo: true } : place;
}

/** Données incohérentes (fiche présente sur deux points) : seul le premier point la garde. */
function dedupeLinks(places: MapPlace[]): MapPlace[] {
  const seen = new Set<string>();
  return places.map((place) => {
    const loreEntryIds = place.loreEntryIds.filter((id) => !seen.has(id));
    loreEntryIds.forEach((id) => seen.add(id));
    return loreEntryIds.length === place.loreEntryIds.length ? place : { ...place, loreEntryIds };
  });
}
