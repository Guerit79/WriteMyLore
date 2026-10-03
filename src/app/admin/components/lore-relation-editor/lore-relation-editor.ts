import { Component, computed, inject, input, signal } from '@angular/core';
import { buildBreadcrumb, getRelationLinks } from '../../../core/lore/lore-navigation';
import { LoreEntry, LoreRelation } from '../../../core/models/lore';
import { LoreStore, toErrorMessage } from '../../../core/services/lore-store';
import { LoreBreadcrumb } from '../../../shared/components/lore-breadcrumb/lore-breadcrumb';
import { LoreRelationLinks } from '../../../shared/components/lore-relation-links/lore-relation-links';
import { adminEntryLink } from '../../admin-sections';
import { LoreRelationForm } from '../lore-relation-form/lore-relation-form';

/** Fil d'Ariane, relations et ajout de relations pour la fiche en cours d'édition. */
@Component({
  selector: 'app-lore-relation-editor',
  imports: [LoreBreadcrumb, LoreRelationLinks, LoreRelationForm],
  templateUrl: './lore-relation-editor.html',
})
export class LoreRelationEditor {
  readonly entry = input.required<LoreEntry>();

  private readonly store = inject(LoreStore);

  protected readonly linkFor = adminEntryLink;
  protected readonly error = signal<string | null>(null);
  protected readonly breadcrumb = computed(() => buildBreadcrumb(this.entry(), this.store.lookup()));
  protected readonly links = computed(() =>
    getRelationLinks(this.entry(), this.store.entries(), this.store.lookup()),
  );

  protected async removeRelation(relation: LoreRelation): Promise<void> {
    this.error.set(null);
    try {
      await this.store.removeRelation(relation.sourceId, relation.id);
    } catch (error) {
      this.error.set(toErrorMessage(error));
    }
  }
}
