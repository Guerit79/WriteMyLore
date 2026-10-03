import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HIERARCHICAL_RELATION_RULES, LoreRelationView } from '../../../core/lore/lore-navigation';
import { LoreStore, toErrorMessage } from '../../../core/services/lore-store';
import { adminEntryLink } from '../../admin-sections';
import { LoreRelationForm } from '../lore-relation-form/lore-relation-form';

type RelationKindFilter = 'all' | 'hierarchical' | 'associated';

/** Section « Relations » : vue globale des relations entre fiches. */
@Component({
  selector: 'app-lore-relations',
  imports: [ReactiveFormsModule, RouterLink, LoreRelationForm],
  templateUrl: './lore-relations.html',
})
export class LoreRelations {
  private readonly store = inject(LoreStore);

  protected readonly rules = HIERARCHICAL_RELATION_RULES;
  protected readonly linkFor = adminEntryLink;
  protected readonly feedback = signal<{ kind: 'success' | 'error'; message: string } | null>(null);
  protected readonly kindControl = inject(NonNullableFormBuilder).control<RelationKindFilter>('all');
  private readonly kind = toSignal(this.kindControl.valueChanges, {
    initialValue: this.kindControl.value,
  });

  protected readonly total = computed(() => this.store.relations().length);
  protected readonly relations = computed(() => {
    const kind = this.kind();
    return this.store
      .relations()
      .filter((view) => kind === 'all' || view.hierarchical === (kind === 'hierarchical'))
      .sort((a, b) => a.source.name.localeCompare(b.source.name, 'fr'));
  });

  protected async remove(view: LoreRelationView): Promise<void> {
    try {
      await this.store.removeRelation(view.source.id, view.relation.id);
      this.feedback.set({
        kind: 'success',
        message: `Relation supprimée : ${view.source.name} ${view.relation.type} ${view.target.name}.`,
      });
    } catch (error) {
      this.feedback.set({ kind: 'error', message: toErrorMessage(error) });
    }
  }
}
