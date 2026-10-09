import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, defer, of, switchMap, throwError, timer } from 'rxjs';
import { DemoAccount, LoginInput, RegisterInput } from '../models/account';
import { AccountRepository } from './account-repository';

/** Profils fictifs (pseudo, e-mail, date) : jamais de mot de passe. */
export const DEMO_ACCOUNTS_KEY = 'writemylore.demo-accounts.v1';
/** Session de démonstration : uniquement l'e-mail du compte ouvert, effacée à la fermeture de l'onglet. */
export const DEMO_SESSION_KEY = 'writemylore.demo-session.v1';

/** Délai simulé des envois (affichage de l'état de chargement). */
export const DEMO_ACCOUNT_LATENCY_MS = new InjectionToken<number>('DEMO_ACCOUNT_LATENCY_MS', {
  factory: () => 400,
});

/**
 * MODE DÉMONSTRATION — aucune sécurité.
 *
 * - Les profils sont conservés dans `localStorage`, la session dans `sessionStorage` :
 *   cette persistance sert au confort de la démo, ce n'est PAS une mesure de sécurité.
 * - Le mot de passe n'est jamais stocké (ni en clair, ni haché) ; il n'est donc pas vérifié
 *   à la connexion : seul un compte de démonstration créé dans ce navigateur peut être ouvert.
 */
@Injectable()
export class DemoAccountRepository extends AccountRepository {
  private readonly latency = inject(DEMO_ACCOUNT_LATENCY_MS);

  restoreSession(): Observable<DemoAccount | null> {
    return defer(() => {
      const email = readSession();
      return of(email ? (findAccount(readAccounts(), email) ?? null) : null);
    });
  }

  // Le mot de passe de `RegisterInput` est volontairement ignoré : il n'est jamais conservé.
  register({ pseudo, email }: RegisterInput): Observable<DemoAccount> {
    return this.simulate(() => {
      const accounts = readAccounts();
      const normalizedEmail = normalizeEmail(email);
      if (findAccount(accounts, normalizedEmail)) {
        throw new Error(
          'Un compte de démonstration utilise déjà cette adresse e-mail dans ce navigateur. Connectez-vous ou choisissez une autre adresse.',
        );
      }
      const account: DemoAccount = {
        pseudo: pseudo.trim(),
        email: normalizedEmail,
        createdAt: new Date().toISOString(),
      };
      writeAccounts([...accounts, account]);
      writeSession(account.email);
      return account;
    });
  }

  // Le mot de passe de `LoginInput` n'est pas vérifié : la démonstration ne le connaît pas.
  login({ email }: LoginInput): Observable<DemoAccount> {
    return this.simulate(() => {
      const account = findAccount(readAccounts(), normalizeEmail(email));
      if (!account) {
        throw new Error(
          'Aucun compte de démonstration n’existe pour cette adresse e-mail dans ce navigateur. Créez d’abord un compte.',
        );
      }
      writeSession(account.email);
      return account;
    });
  }

  logout(): Observable<void> {
    return defer(() => {
      clearSession();
      return of(undefined);
    });
  }

  /** Exécute l'opération après le délai simulé ; ses erreurs sont aussi retardées. */
  private simulate<T>(operation: () => T): Observable<T> {
    return timer(this.latency).pipe(
      switchMap(() => {
        try {
          return of(operation());
        } catch (error) {
          return throwError(() => error);
        }
      }),
    );
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function findAccount(accounts: readonly DemoAccount[], email: string): DemoAccount | undefined {
  return accounts.find((account) => account.email === email);
}

function isDemoAccount(value: unknown): value is DemoAccount {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record['pseudo'] === 'string' &&
    typeof record['email'] === 'string' &&
    typeof record['createdAt'] === 'string'
  );
}

function readAccounts(): DemoAccount[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DEMO_ACCOUNTS_KEY) ?? '[]');
    // Seuls les champs d'affichage sont repris, même si le stockage contenait autre chose.
    return Array.isArray(parsed)
      ? parsed.filter(isDemoAccount).map(({ pseudo, email, createdAt }) => ({ pseudo, email, createdAt }))
      : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: readonly DemoAccount[]): void {
  try {
    localStorage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Stockage indisponible : le compte reste valable pour la session en cours seulement.
  }
}

function readSession(): string | null {
  try {
    return sessionStorage.getItem(DEMO_SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSession(email: string): void {
  try {
    sessionStorage.setItem(DEMO_SESSION_KEY, email);
  } catch {
    // Stockage indisponible : la session ne survivra pas à un rechargement.
  }
}

function clearSession(): void {
  try {
    sessionStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    // Rien à nettoyer.
  }
}
