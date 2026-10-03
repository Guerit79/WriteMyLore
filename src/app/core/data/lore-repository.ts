import { Observable } from 'rxjs';
import { LoreEntry, LoreEntryId, LoreEntryInput, LoreRelationInput } from '../models/lore';

/**
 * Contrat d'accès aux données du Lore.
 *
 * L'implémentation actuelle (`LocalStorageLoreRepository`) stocke tout dans le navigateur.
 * Pour brancher le backend Spring Boot, il suffira d'écrire un `HttpLoreRepository` respectant
 * ce contrat et de changer le provider dans `app.config.ts`. Correspondance REST envisagée :
 *
 * - findAll         → GET    /api/lore-entries
 * - create          → POST   /api/lore-entries
 * - update          → PUT    /api/lore-entries/{id}
 * - delete          → DELETE /api/lore-entries/{id}  (supprime aussi les relations qui la ciblent)
 * - addRelation     → POST   /api/lore-entries/{id}/relations
 * - removeRelation  → DELETE /api/lore-entries/{id}/relations/{relationId}
 */
export abstract class LoreRepository {
  abstract findAll(): Observable<LoreEntry[]>;

  abstract create(input: LoreEntryInput): Observable<LoreEntry>;

  abstract update(id: LoreEntryId, input: LoreEntryInput): Observable<LoreEntry>;

  abstract delete(id: LoreEntryId): Observable<void>;

  /** Retourne la fiche source mise à jour. */
  abstract addRelation(sourceId: LoreEntryId, input: LoreRelationInput): Observable<LoreEntry>;

  /** Retourne la fiche source mise à jour. */
  abstract removeRelation(sourceId: LoreEntryId, relationId: string): Observable<LoreEntry>;
}
