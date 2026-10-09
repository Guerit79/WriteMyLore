import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AccountRepository } from '../data/account-repository';
import { DemoAccount, LoginInput, RegisterInput } from '../models/account';

/**
 * État du compte (connecté / déconnecté) partagé par l'interface publique.
 * MODE DÉMONSTRATION : cet état n'est qu'un affichage, il ne protège aucune page ni aucune donnée.
 */
@Injectable({ providedIn: 'root' })
export class AccountStore {
  private readonly repository = inject(AccountRepository);
  private readonly userState = signal<DemoAccount | null>(null);

  readonly user = this.userState.asReadonly();
  readonly isLoggedIn = computed(() => this.userState() !== null);

  constructor() {
    this.repository.restoreSession().subscribe({
      next: (account) => this.userState.set(account),
      error: () => this.userState.set(null),
    });
  }

  async register(input: RegisterInput): Promise<DemoAccount> {
    const account = await firstValueFrom(this.repository.register(input));
    this.userState.set(account);
    return account;
  }

  async login(input: LoginInput): Promise<DemoAccount> {
    const account = await firstValueFrom(this.repository.login(input));
    this.userState.set(account);
    return account;
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.repository.logout());
    this.userState.set(null);
  }
}
