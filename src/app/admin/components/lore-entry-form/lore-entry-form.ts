import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  LORE_ENTRY_STATUSES,
  LORE_ENTRY_TYPES,
  LoreEntry,
  LoreEntryInput,
  LoreEntryStatus,
  LoreEntryType,
} from '../../../core/models/lore';

const NAME_MAX_LENGTH = 120;
const SUMMARY_MAX_LENGTH = 500;

let nextFormId = 0;

/** `Validators.required` accepte une chaîne d'espaces : on la refuse ici. */
function requiredText(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { required: true };
}

type EntryField = 'name' | 'type' | 'summary';

/** Formulaire de création / modification d'une fiche. N'enregistre rien : émet `save`. */
@Component({
  selector: 'app-lore-entry-form',
  imports: [ReactiveFormsModule],
  templateUrl: './lore-entry-form.html',
})
export class LoreEntryForm {
  readonly entry = input<LoreEntry | null>(null);
  readonly submitLabel = input('Enregistrer');
  readonly save = output<LoreEntryInput>();
  readonly cancelled = output<void>();

  protected readonly types = LORE_ENTRY_TYPES;
  protected readonly statuses = LORE_ENTRY_STATUSES;
  protected readonly nameMaxLength = NAME_MAX_LENGTH;
  protected readonly summaryMaxLength = SUMMARY_MAX_LENGTH;
  protected readonly id = `lore-entry-form-${nextFormId++}`;
  protected readonly submitted = signal(false);

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    name: this.fb.control('', [requiredText, Validators.maxLength(NAME_MAX_LENGTH)]),
    type: this.fb.control<LoreEntryType | ''>('', Validators.required),
    summary: this.fb.control('', Validators.maxLength(SUMMARY_MAX_LENGTH)),
    content: this.fb.control(''),
    status: this.fb.control<LoreEntryStatus>('Brouillon'),
  });

  /** On ne réinitialise le formulaire que lorsqu'on change de fiche, pas à chaque mise à jour. */
  private readonly entryId = computed(() => this.entry()?.id ?? null);

  constructor() {
    effect(() => {
      this.entryId();
      untracked(() => this.reset(this.entry()));
    });
  }

  protected showError(field: EntryField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }

  protected errorId(field: EntryField): string | null {
    return this.showError(field) ? `${this.id}-${field}-error` : null;
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, type, summary, content, status } = this.form.getRawValue();
    if (type === '') {
      return;
    }
    this.save.emit({ name, type, summary, content, status });
    this.form.markAsPristine();
  }

  private reset(entry: LoreEntry | null): void {
    this.submitted.set(false);
    this.form.reset({
      name: entry?.name ?? '',
      type: entry?.type ?? '',
      summary: entry?.summary ?? '',
      content: entry?.content ?? '',
      status: entry?.status ?? 'Brouillon',
    });
  }
}
