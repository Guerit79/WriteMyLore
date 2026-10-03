import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import {
  LORE_ENTRY_STATUSES,
  LORE_ENTRY_TYPES,
  LORE_RELATION_TYPES,
  LoreEntry,
  LoreEntryId,
  LoreEntryInput,
  LoreRelation,
  LoreRelationInput,
} from '../models/lore';
import { createDemoEntries } from './lore-demo-data';
import { LoreRepository } from './lore-repository';

export const LORE_STORAGE_KEY = 'writemylore.lore.v1';

/**
 * Stockage local (prototype) : les fiches sont gardées en mémoire et recopiées dans `localStorage`.
 * Si le stockage est vide, illisible ou indisponible, les données de démonstration sont utilisées.
 */
@Injectable()
export class LocalStorageLoreRepository extends LoreRepository {
  private entries: LoreEntry[] = this.read();

  findAll(): Observable<LoreEntry[]> {
    return of(structuredClone(this.entries));
  }

  create(input: LoreEntryInput): Observable<LoreEntry> {
    const now = new Date().toISOString();
    const entry: LoreEntry = { id: createId(), ...input, relations: [], createdAt: now, updatedAt: now };
    this.entries = [...this.entries, entry];
    this.write();
    return of(structuredClone(entry));
  }

  update(id: LoreEntryId, input: LoreEntryInput): Observable<LoreEntry> {
    return this.mutate(id, (entry) => ({ ...entry, ...input }));
  }

  delete(id: LoreEntryId): Observable<void> {
    if (!this.entries.some((entry) => entry.id === id)) {
      return throwError(() => new Error('Fiche introuvable.'));
    }
    this.entries = this.entries
      .filter((entry) => entry.id !== id)
      .map((entry) => ({
        ...entry,
        relations: entry.relations.filter((relation) => relation.targetId !== id),
      }));
    this.write();
    return of(undefined);
  }

  addRelation(sourceId: LoreEntryId, input: LoreRelationInput): Observable<LoreEntry> {
    const relation: LoreRelation = { id: createId(), sourceId, ...input };
    return this.mutate(sourceId, (entry) => ({ ...entry, relations: [...entry.relations, relation] }));
  }

  removeRelation(sourceId: LoreEntryId, relationId: string): Observable<LoreEntry> {
    return this.mutate(sourceId, (entry) => ({
      ...entry,
      relations: entry.relations.filter((relation) => relation.id !== relationId),
    }));
  }

  private mutate(id: LoreEntryId, change: (entry: LoreEntry) => LoreEntry): Observable<LoreEntry> {
    const current = this.entries.find((entry) => entry.id === id);
    if (!current) {
      return throwError(() => new Error('Fiche introuvable.'));
    }
    const updated: LoreEntry = { ...change(current), updatedAt: new Date().toISOString() };
    this.entries = this.entries.map((entry) => (entry.id === id ? updated : entry));
    this.write();
    return of(structuredClone(updated));
  }

  private read(): LoreEntry[] {
    try {
      const raw = localStorage.getItem(LORE_STORAGE_KEY);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every(isLoreEntry)) {
          return parsed;
        }
      }
    } catch {
      // Stockage indisponible ou contenu corrompu : on repart des données de démonstration.
    }
    return createDemoEntries();
  }

  private write(): void {
    try {
      localStorage.setItem(LORE_STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // Stockage indisponible (navigation privée, quota…) : les données restent en mémoire.
    }
  }
}

function createId(): string {
  // randomUUID n'existe que dans un contexte sécurisé (https ou localhost).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

function isLoreRelation(value: unknown): value is LoreRelation {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['sourceId'] === 'string' &&
    typeof value['targetId'] === 'string' &&
    isOneOf(LORE_RELATION_TYPES, value['type'])
  );
}

function isLoreEntry(value: unknown): value is LoreEntry {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    typeof value['summary'] === 'string' &&
    typeof value['content'] === 'string' &&
    typeof value['createdAt'] === 'string' &&
    typeof value['updatedAt'] === 'string' &&
    isOneOf(LORE_ENTRY_TYPES, value['type']) &&
    isOneOf(LORE_ENTRY_STATUSES, value['status']) &&
    Array.isArray(value['relations']) &&
    value['relations'].every(isLoreRelation)
  );
}
