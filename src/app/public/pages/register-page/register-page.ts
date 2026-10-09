import { Component, ElementRef, Injector, afterNextRender, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  PASSWORD_MIN_LENGTH,
  PSEUDO_MAX_LENGTH,
  PSEUDO_MIN_LENGTH,
} from '../../../core/models/account';
import { AccountStore } from '../../../core/services/account-store';
import { toErrorMessage } from '../../../core/services/lore-store';
import { AccountSheet } from '../../components/account-sheet/account-sheet';
import {
  emailFormat,
  focusFirstInvalidField,
  passwordsMatch,
  requiredText,
} from '../../account-validators';

type RegisterField = 'pseudo' | 'email' | 'password' | 'passwordConfirmation';

/** Inscription — MODE DÉMONSTRATION : crée un profil fictif dans ce navigateur, sans mot de passe stocké. */
@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, AccountSheet],
  templateUrl: './register-page.html',
})
export class RegisterPage {
  private readonly account = inject(AccountStore);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly pseudoMinLength = PSEUDO_MIN_LENGTH;
  protected readonly pseudoMaxLength = PSEUDO_MAX_LENGTH;
  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  protected readonly submitted = signal(false);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPasswords = signal(false);

  protected readonly form = this.fb.group(
    {
      pseudo: this.fb.control('', [
        requiredText,
        Validators.minLength(PSEUDO_MIN_LENGTH),
        Validators.maxLength(PSEUDO_MAX_LENGTH),
      ]),
      email: this.fb.control('', [requiredText, emailFormat]),
      password: this.fb.control('', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]),
      passwordConfirmation: this.fb.control('', Validators.required),
    },
    { validators: passwordsMatch },
  );

  protected showError(field: RegisterField): boolean {
    const control = this.form.controls[field];
    const invalid =
      control.invalid || (field === 'passwordConfirmation' && this.form.hasError('passwordMismatch'));
    return invalid && (control.touched || this.submitted());
  }

  protected errorId(field: RegisterField): string | null {
    return this.showError(field) ? `register-${field}-error` : null;
  }

  protected async submit(): Promise<void> {
    if (this.pending()) {
      return;
    }
    this.submitted.set(true);
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      afterNextRender(() => focusFirstInvalidField(this.host.nativeElement), { injector: this.injector });
      return;
    }
    this.pending.set(true);
    try {
      const { pseudo, email, password } = this.form.getRawValue();
      await this.account.register({ pseudo, email, password });
      // Les mots de passe ne restent pas dans le formulaire une fois le compte créé.
      this.form.controls.password.reset();
      this.form.controls.passwordConfirmation.reset();
      await this.router.navigate(['/profil']);
    } catch (error) {
      // Les champs sont conservés pour permettre une correction (ex. autre adresse e-mail).
      this.error.set(toErrorMessage(error));
    } finally {
      this.pending.set(false);
    }
  }
}
