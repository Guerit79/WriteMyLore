import { Observable } from 'rxjs';
import { DemoAccount, LoginInput, RegisterInput } from '../models/account';

/**
 * Contrat d'accès aux comptes.
 *
 * L'implémentation actuelle (`DemoAccountRepository`) est une SIMULATION locale, sans aucune sécurité.
 * Une vraie authentification passera par un `HttpAccountRepository` branché sur le backend
 * (Spring Boot) et déclaré dans `app.config.ts`, à la place de la démonstration. Le serveur devra alors
 * vérifier les identifiants, hacher les mots de passe et gérer la session (cookie HttpOnly ou jeton).
 */
export abstract class AccountRepository {
  /** Compte de la session en cours, ou `null`. */
  abstract restoreSession(): Observable<DemoAccount | null>;

  abstract register(input: RegisterInput): Observable<DemoAccount>;

  abstract login(input: LoginInput): Observable<DemoAccount>;

  abstract logout(): Observable<void>;
}
