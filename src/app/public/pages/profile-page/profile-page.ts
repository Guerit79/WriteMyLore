import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountStore } from '../../../core/services/account-store';
import { AccountSheet } from '../../components/account-sheet/account-sheet';

const CREATED_AT_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

/**
 * Profil du compte de démonstration. Sans session, aucun profil n'est affiché :
 * la page propose de se connecter ou de créer un compte.
 */
@Component({
  selector: 'app-profile-page',
  imports: [RouterLink, AccountSheet],
  templateUrl: './profile-page.html',
})
export class ProfilePage {
  private readonly account = inject(AccountStore);

  protected readonly user = this.account.user;
  protected readonly pending = signal(false);
  protected readonly loggedOut = signal(false);
  protected readonly createdAtLabel = computed(() => {
    const createdAt = this.user()?.createdAt;
    return createdAt ? CREATED_AT_FORMAT.format(new Date(createdAt)) : '';
  });

  protected async logout(): Promise<void> {
    this.pending.set(true);
    try {
      await this.account.logout();
      this.loggedOut.set(true);
    } finally {
      this.pending.set(false);
    }
  }
}
