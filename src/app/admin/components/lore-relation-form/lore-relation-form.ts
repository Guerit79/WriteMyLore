import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { map } from 'rxjs';
import { isHierarchicalRelation } from '../../../core/lore/lore-navigation';
import { LORE_RELATION_TYPES, LoreRelationType } from '../../../core/models/lore';
import { LoreStore, toErrorMessage } from '../../../core/services/lore-store';

let nextFormId = 0;

function notSelfRelation(group: AbstractControl): ValidationErrors | null {
  const sourceId: unknown = group.get('sourceId')?.value;
  const targetId: unknown = group.get('targetId')?.value;
  return sourceId && sourceId === targetId ? { selfRelation: true } : null;
}

type RelationField = 'sourceId' | 'type' | 'targetId';

/**
 * Ajout d'une relation. Si `sourceId` est fourni (édition d'une fiche), la source est imposée ;
 * sinon un sélecteur de fiche source est affiché.
 */
@Component({
  selector: 'app-lore-relation-form',
  imports: [ReactiveFormsModule],
  templateUrl: './lore-relation-form.html',
})
export class LoreRelationForm {
  readonly sourceId = input<string | null>(null);

  private readonly store = inject(LoreStore);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly relationTypes = LORE_RELATION_TYPES;
  protected readonly id = `lore-relation-form-${nextFormId++}`;
  protected readonly submitted = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      sourceId: this.fb.control('', Validators.required),
      type: this.fb.control<LoreRelationType | ''>('', Validators.required),
      targetId: this.fb.control('', Validators.required),
    },
    { validators: notSelfRelation },
  );

  private readonly value = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly sortedEntries = computed(() =>
    [...this.store.entries()].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  );

  /** La fiche source n'est jamais proposée comme cible. */
  protected readonly targetOptions = computed(() => {
    const sourceId = this.value().sourceId;
    return this.sortedEntries().filter((entry) => entry.id !== sourceId);
  });

  protected readonly hierarchyHint = computed(() => {
    const { sourceId, type } = this.value();
    const source = this.store.findById(sourceId);
    if (!source || type === '') {
      return null;
    }
    return isHierarchicalRelation(source.type, type)
      ? `Relation hiérarchique : elle alimentera le fil d’Ariane de « ${source.name} ».`
      : 'Relation associée : elle apparaîtra dans les relations, pas dans le fil d’Ariane.';
  });

  constructor() {
    effect(() => {
      const sourceId = this.sourceId();
      if (sourceId) {
        this.form.controls.sourceId.setValue(sourceId);
        this.resetMessages();
      }
    });
  }

  protected showError(field: RelationField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }

  protected errorId(field: RelationField): string | null {
    return this.showError(field) ? `${this.id}-${field}-error` : null;
  }

  protected showSelfError(): boolean {
    return this.form.hasError('selfRelation') && (this.form.touched || this.submitted());
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.resetMessages();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { sourceId, type, targetId } = this.form.getRawValue();
    if (type === '') {
      return;
    }
    try {
      await this.store.addRelation(sourceId, { type, targetId });
      const source = this.store.findById(sourceId)?.name ?? '';
      const target = this.store.findById(targetId)?.name ?? '';
      this.success.set(`Relation ajoutée : ${source} ${type} ${target}.`);
      this.submitted.set(false);
      this.form.reset({ sourceId: this.sourceId() ?? sourceId, type: '', targetId: '' });
    } catch (error) {
      this.error.set(toErrorMessage(error));
    }
  }

  private resetMessages(): void {
    this.error.set(null);
    this.success.set(null);
  }
}
