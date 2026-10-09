import { Observable } from 'rxjs';
import { MapBorder, MapBorderSettings } from '../models/map-border';

/**
 * Contrat d'accès aux frontières de royaumes (même principe que `WorldMapRepository`).
 *
 * L'implémentation actuelle (`LocalStorageMapBorderRepository`) stocke tout dans le navigateur,
 * sous une clé distincte de celle des lieux (les données des lieux ne changent pas de format).
 * Correspondance REST envisagée :
 *
 * - findAll      → GET    /api/map-borders
 * - save         → PUT    /api/map-borders/{id}  (création ou remplacement)
 * - delete       → DELETE /api/map-borders/{id}
 * - getSettings  → GET    /api/map-borders/settings
 * - saveSettings → PUT    /api/map-borders/settings
 */
export abstract class MapBorderRepository {
  abstract findAll(): Observable<MapBorder[]>;

  /** Retourne la liste complète à jour. */
  abstract save(border: MapBorder): Observable<MapBorder[]>;

  /** Retourne la liste complète à jour. */
  abstract delete(id: string): Observable<MapBorder[]>;

  abstract getSettings(): Observable<MapBorderSettings>;

  abstract saveSettings(settings: MapBorderSettings): Observable<MapBorderSettings>;
}
