import { computed, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LoreRepository } from '../data/lore-repository';
import { indexEntries, listRelations } from '../lore/lore-navigation';
import {
  LoreEntry,
  LoreEntryId,
  LoreEntryInput,
  LoreEntryStatus,
  LoreRelationInput,
} from '../models/lore';

export interface LoreStats {
  total: number;
  published: number;
  drafts: number;
  relations: number;
  hierarchicalRelations: number;
  associatedRelations: number;
}

/**
 * État partagé du Lore (signals) pour les composants publics et l'administration.
 * Les composants ne parlent qu'à ce service ; la persistance est déléguée à `LoreRepository`.
 */
@Injectable({ providedIn: 'root' })
export class LoreStore {
  private readonly repository = inject(LoreRepository);
  private readonly entriesState = signal<readonly LoreEntry[]>([]);
  private readonly loadErrorState = signal<string | null>(null);
  private readonly loadedState = signal(false);

  readonly entries = this.entriesState.asReadonly();
  readonly loadError = this.loadErrorState.asReadonly();
  /** Vrai une fois le premier chargement terminé (succès ou échec). */
  readonly loaded = this.loadedState.asReadonly();
  readonly lookup = computed(() => indexEntries(this.entriesState()));
  readonly publishedEntries = computed(() =>
    this.entriesState().filter((entry) => entry.status === 'Publié'),
  );
  /** Index des seules fiches publiées : base de toute la lecture publique. */
  readonly publishedLookup = computed(() => indexEntries(this.publishedEntries()));
  readonly relations = computed(() => listRelations(this.entriesState(), this.lookup()));

  readonly stats = computed<LoreStats>(() => {
    const entries = this.entriesState();
    const relations = this.relations();
    const published = entries.filter((entry) => entry.status === 'Publié').length;
    const hierarchical = relations.filter((view) => view.hierarchical).length;
    return {
      total: entries.length,
      published,
      drafts: entries.length - published,
      relations: relations.length,
      hierarchicalRelations: hierarchical,
      associatedRelations: relations.length - hierarchical,
    };
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.repository.findAll().subscribe({
      next: (entries) => {
        this.entriesState.set(entries);
        this.loadErrorState.set(null);
        this.loadedState.set(true);
      },
      error: () => {
        this.loadErrorState.set('Impossible de charger les fiches du Lore.');
        this.loadedState.set(true);
      },
    });
  }

  findById(id: LoreEntryId): LoreEntry | undefined {
    return this.lookup().get(id);
  }

  /** Fiche consultable publiquement : `undefined` si elle n'existe pas ou n'est pas publiée. */
  findPublished(id: LoreEntryId): LoreEntry | undefined {
    return this.publishedLookup().get(id);
  }

  async create(input: LoreEntryInput): Promise<LoreEntry> {
    const created = await firstValueFrom(this.repository.create(normalizeInput(input)));
    this.entriesState.update((entries) => [...entries, created]);
    return created;
  }

  async update(id: LoreEntryId, input: LoreEntryInput): Promise<LoreEntry> {
    this.require(id);
    const updated = await firstValueFrom(this.repository.update(id, normalizeInput(input)));
    this.replace(updated);
    return updated;
  }

  async setStatus(id: LoreEntryId, status: LoreEntryStatus): Promise<LoreEntry> {
    const { name, type, summary, content } = this.require(id);
    return this.update(id, { name, type, summary, content, status });
  }

  async remove(id: LoreEntryId): Promise<void> {
    this.require(id);
    await firstValueFrom(this.repository.delete(id));
    this.entriesState.update((entries) =>
      entries
        .filter((entry) => entry.id !== id)
        .map((entry) =>
          entry.relations.some((relation) => relation.targetId === id)
            ? { ...entry, relations: entry.relations.filter((relation) => relation.targetId !== id) }
            : entry,
        ),
    );
  }

  async addRelation(sourceId: LoreEntryId, input: LoreRelationInput): Promise<LoreEntry> {
    const source = this.require(sourceId);
    if (input.targetId === sourceId) {
      throw new Error('Une fiche ne peut pas être liée à elle-même.');
    }
    if (!this.lookup().has(input.targetId)) {
      throw new Error('La fiche cible est introuvable.');
    }
    if (source.relations.some((r) => r.type === input.type && r.targetId === input.targetId)) {
      throw new Error('Cette relation existe déjà.');
    }
    const updated = await firstValueFrom(this.repository.addRelation(sourceId, input));
    this.replace(updated);
    return updated;
  }

  async removeRelation(sourceId: LoreEntryId, relationId: string): Promise<LoreEntry> {
    this.require(sourceId);
    const updated = await firstValueFrom(this.repository.removeRelation(sourceId, relationId));
    this.replace(updated);
    return updated;
  }

  private require(id: LoreEntryId): LoreEntry {
    const entry = this.findById(id);
    if (!entry) {
      throw new Error('Fiche introuvable.');
    }
    return entry;
  }

  private replace(updated: LoreEntry): void {
    this.entriesState.update((entries) =>
      entries.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
  }
}

function normalizeInput(input: LoreEntryInput): LoreEntryInput {
  return {
    ...input,
    name: input.name.trim(),
    summary: input.summary.trim(),
    content: input.content.trim(),
  };
}

/** Message lisible à partir d'une erreur inconnue (repository, store…). */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur inattendue est survenue.';
}
