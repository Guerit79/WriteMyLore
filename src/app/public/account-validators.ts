import { AbstractControl, ValidationErrors } from '@angular/forms';

/*
 * Validations des formulaires de compte : elles guident la saisie uniquement.
 * Elles ne remplacent pas une validation côté serveur.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Obligatoire, une saisie composée uniquement d'espaces étant considérée comme vide. */
export function requiredText(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { required: true };
}

/** Format d'adresse e-mail (nom@domaine.ext). Le champ vide est laissé à `requiredText`. */
export function emailFormat(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  return !value || EMAIL_PATTERN.test(value) ? null : { email: true };
}

/** Après un envoi refusé : place le focus sur le premier champ en erreur (après rendu des messages). */
export function focusFirstInvalidField(form: HTMLElement): void {
  form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

/** Le mot de passe et sa confirmation doivent être identiques (validateur de groupe). */
export function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password: unknown = group.get('password')?.value;
  const confirmation: unknown = group.get('passwordConfirmation')?.value;
  return confirmation && password !== confirmation ? { passwordMismatch: true } : null;
}
