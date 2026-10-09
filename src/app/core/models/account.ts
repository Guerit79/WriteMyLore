/**
 * Comptes utilisateurs — MODE DÉMONSTRATION.
 * Seules les données nécessaires à l'affichage du profil sont conservées : jamais le mot de passe.
 */

export interface DemoAccount {
  pseudo: string;
  email: string;
  /** Date ISO 8601 de création du compte de démonstration. */
  createdAt: string;
}

/** Saisie d'inscription. Le mot de passe sert uniquement à la validation du formulaire. */
export interface RegisterInput {
  pseudo: string;
  email: string;
  password: string;
}

/** Saisie de connexion. En démonstration, le mot de passe n'est ni conservé ni vérifié. */
export interface LoginInput {
  email: string;
  password: string;
}

export const PSEUDO_MIN_LENGTH = 2;
export const PSEUDO_MAX_LENGTH = 30;
export const PASSWORD_MIN_LENGTH = 8;
