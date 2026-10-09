import { Component, ElementRef, Injector, afterNextRender, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PASSWORD_MIN_LENGTH } from '../../../core/models/account';
import { AccountStore } from '../../../core/services/account-store';
import { toErrorMessage } from '../../../core/services/lore-store';
import { AccountSheet } from '../../components/account-sheet/account-sheet';
import { emailFormat, focusFirstInvalidField, requiredText } from '../../account-validators';

type LoginField = 'email' | 'password';

/** Connexion — MODE DÉMONSTRATION : seul un compte créé dans ce navigateur peut être ouvert. */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, AccountSheet],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly account = inject(AccountStore);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly user = this.account.user;
  protected readonly passwordMinLength = PASSWORD_MIN_LENGTH;
  protected readonly submitted = signal(false);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.group({
    email: this.fb.control('', [requiredText, emailFormat]),
    password: this.fb.control('', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]),
  });

  protected showError(field: LoginField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }

  protected errorId(field: LoginField): string | null {
    return this.showError(field) ? `login-${field}-error` : null;
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
      await this.account.login(this.form.getRawValue());
      // Le mot de passe ne reste pas dans le formulaire une fois la connexion faite.
      this.form.controls.password.reset();
      await this.router.navigate(['/profil']);
    } catch (error) {
      // Les champs sont conservés pour permettre une correction.
      this.error.set(toErrorMessage(error));
    } finally {
      this.pending.set(false);
    }
  }
}
