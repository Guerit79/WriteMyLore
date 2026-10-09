import { Observable } from 'rxjs';
import { MapPlace } from '../models/world-map';

/**
 * Contrat d'accès aux points de la carte (même principe que `LoreRepository`).
 *
 * L'implémentation actuelle (`LocalStorageWorldMapRepository`) stocke tout dans le navigateur.
 * Pour brancher le backend, écrire une implémentation HTTP et changer le provider dans
 * `app.config.ts`. Correspondance REST envisagée :
 *
 * - findAll → GET    /api/map-places
 * - save    → PUT    /api/map-places/{id}  (création ou remplacement)
 * - delete  → DELETE /api/map-places/{id}
 *
 * Règle métier : une fiche est liée à au plus un point. Enregistrer un point qui contient une
 * fiche la retire de l'éventuel autre point ; `save` renvoie donc la liste complète à jour.
 */
export abstract class WorldMapRepository {
  abstract findAll(): Observable<MapPlace[]>;

  abstract save(place: MapPlace): Observable<MapPlace[]>;

  abstract delete(id: string): Observable<MapPlace[]>;
}
