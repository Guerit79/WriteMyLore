import { Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LORE_ENTRY_STATUSES,
  LORE_ENTRY_TYPES,
  LoreEntry,
  LoreEntryInput,
  LoreEntryStatus,
  LoreEntryType,
} from '../../../core/models/lore';
import { LoreStore, toErrorMessage } from '../../../core/services/lore-store';
import { NEW_ENTRY_PARAM, adminEntryLink } from '../../admin-sections';
import { LoreEntryForm } from '../lore-entry-form/lore-entry-form';
import { LoreRelationEditor } from '../lore-relation-editor/lore-relation-editor';

/** Recherche insensible à la casse et aux accents. */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/**
 * Section « Fiches du Lore » : liste filtrable et éditeur.
 * La fiche éditée est portée par l'URL (`?section=fiches&fiche=<id>` ou `fiche=nouvelle`).
 */
@Component({
  selector: 'app-lore-entries',
  imports: [ReactiveFormsModule, RouterLink, LoreEntryForm, LoreRelationEditor],
  templateUrl: './lore-entries.html',
})
export class LoreEntries {
  readonly editedId = input<string>();

  private readonly store = inject(LoreStore);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly types = LORE_ENTRY_TYPES;
  protected readonly statuses = LORE_ENTRY_STATUSES;
  protected readonly linkFor = adminEntryLink;
  protected readonly newEntryParams = { section: 'fiches', fiche: NEW_ENTRY_PARAM };
  protected readonly pendingDeleteId = signal<string | null>(null);
  protected readonly feedback = signal<{ kind: 'success' | 'error'; message: string } | null>(null);

  protected readonly filters = this.fb.group({
    search: this.fb.control(''),
    type: this.fb.control<LoreEntryType | ''>(''),
    status: this.fb.control<LoreEntryStatus | ''>(''),
  });
  private readonly filterValue = toSignal(this.filters.valueChanges, {
    initialValue: this.filters.getRawValue(),
  });

  protected readonly total = computed(() => this.store.entries().length);
  protected readonly filteredEntries = computed(() => {
    const { search = '', type = '', status = '' } = this.filterValue();
    const query = normalize(search);
    return this.store
      .entries()
      .filter(
        (entry) =>
          (!query || normalize(entry.name).includes(query)) &&
          (!type || entry.type === type) &&
          (!status || entry.status === status),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  });

  protected readonly isCreating = computed(() => this.editedId() === NEW_ENTRY_PARAM);
  protected readonly editorOpen = computed(() => !!this.editedId());
  protected readonly editedEntry = computed(() => {
    const id = this.editedId();
    return id && id !== NEW_ENTRY_PARAM ? (this.store.findById(id) ?? null) : null;
  });

  protected async save(input: LoreEntryInput): Promise<void> {
    try {
      const current = this.editedEntry();
      if (current) {
        await this.store.update(current.id, input);
        this.feedback.set({ kind: 'success', message: `Fiche « ${input.name.trim()} » enregistrée.` });
      } else {
        const created = await this.store.create(input);
        this.feedback.set({
          kind: 'success',
          message: `Fiche « ${created.name} » créée. Vous pouvez maintenant lui ajouter des relations.`,
        });
        await this.router.navigate(['/admin'], { queryParams: { section: 'fiches', fiche: created.id } });
      }
    } catch (error) {
      this.feedback.set({ kind: 'error', message: toErrorMessage(error) });
    }
  }

  protected async toggleStatus(entry: LoreEntry): Promise<void> {
    const status: LoreEntryStatus = entry.status === 'Publié' ? 'Brouillon' : 'Publié';
    try {
      await this.store.setStatus(entry.id, status);
      this.feedback.set({
        kind: 'success',
        message:
          status === 'Publié'
            ? `« ${entry.name} » est publiée.`
            : `« ${entry.name} » est repassée en brouillon.`,
      });
    } catch (error) {
      this.feedback.set({ kind: 'error', message: toErrorMessage(error) });
    }
  }

  protected async remove(entry: LoreEntry): Promise<void> {
    this.pendingDeleteId.set(null);
    try {
      await this.store.remove(entry.id);
      this.feedback.set({ kind: 'success', message: `Fiche « ${entry.name} » supprimée.` });
      if (this.editedId() === entry.id) {
        await this.closeEditor();
      }
    } catch (error) {
      this.feedback.set({ kind: 'error', message: toErrorMessage(error) });
    }
  }

  protected async closeEditor(): Promise<void> {
    await this.router.navigate(['/admin'], { queryParams: { section: 'fiches' } });
  }
}
