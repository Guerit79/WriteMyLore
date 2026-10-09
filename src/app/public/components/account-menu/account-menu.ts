import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountStore } from '../../../core/services/account-store';

/**
 * Accès au compte depuis le grimoire public : « Connexion / Inscription » pour un visiteur,
 * « Mon profil » et « Déconnexion » une fois connecté (mode démonstration).
 */
@Component({
  selector: 'app-account-menu',
  imports: [RouterLink],
  templateUrl: './account-menu.html',
  styleUrl: './account-menu.css',
})
export class AccountMenu {
  private readonly account = inject(AccountStore);
  private readonly injector = inject(Injector);
  private readonly loginLink = viewChild<ElementRef<HTMLAnchorElement>>('loginLink');

  protected readonly user = this.account.user;
  protected readonly pending = signal(false);

  protected async logout(): Promise<void> {
    this.pending.set(true);
    try {
      await this.account.logout();
    } finally {
      this.pending.set(false);
    }
    // Le bouton cliqué disparaît : le focus clavier passe au lien de connexion qui le remplace.
    afterNextRender(() => this.loginLink()?.nativeElement.focus(), { injector: this.injector });
  }
}
