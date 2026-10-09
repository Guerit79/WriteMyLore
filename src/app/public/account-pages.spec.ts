import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { AccountRepository } from '../core/data/account-repository';
import {
  DEMO_ACCOUNTS_KEY,
  DEMO_ACCOUNT_LATENCY_MS,
  DEMO_SESSION_KEY,
  DemoAccountRepository,
} from '../core/data/demo-account-repository';
import { LORE_STORAGE_KEY, LocalStorageLoreRepository } from '../core/data/local-storage-lore-repository';
import { LoreRepository } from '../core/data/lore-repository';
import { AccountStore } from '../core/services/account-store';

/** Comptes de démonstration : pages, validations, état connecté / déconnecté, navigation. */
describe('Comptes (mode démonstration)', () => {
  const LATENCY = 40;
  const PASSWORD = 'GrimoireSecret8';
  let harness: RouterTestingHarness;

  const root = () => harness.fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const url = () => TestBed.inject(Router).url;

  function clearStorage(): void {
    localStorage.removeItem(DEMO_ACCOUNTS_KEY);
    localStorage.removeItem(LORE_STORAGE_KEY);
    sessionStorage.removeItem(DEMO_SESSION_KEY);
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function go(path: string): Promise<void> {
    await harness.navigateByUrl(path);
    await settle();
  }

  function el<T extends HTMLElement>(selector: string): T {
    const found = root().querySelector<T>(selector);
    if (!found) {
      throw new Error(`Élément introuvable : ${selector}`);
    }
    return found;
  }

  function type(selector: string, value: string): void {
    const input = el<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  /** Laisse passer le délai réseau simulé, puis la navigation qui suit. */
  async function afterLatency(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, LATENCY + 40));
    await settle();
  }

  /** Envoi du formulaire comme avec la touche Entrée (événement submit natif). */
  async function submitWithEnter(): Promise<void> {
    el<HTMLFormElement>('form.account-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    await afterLatency();
  }

  async function register(pseudo: string, email: string): Promise<void> {
    await go('/inscription');
    type('#register-pseudo', pseudo);
    type('#register-email', email);
    type('#register-password', PASSWORD);
    type('#register-password-confirmation', PASSWORD);
    await submitWithEnter();
  }

  beforeEach(async () => {
    clearStorage();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideLocationMocks(),
        { provide: LoreRepository, useClass: LocalStorageLoreRepository },
        { provide: AccountRepository, useClass: DemoAccountRepository },
        { provide: DEMO_ACCOUNT_LATENCY_MS, useValue: LATENCY },
      ],
    });
    harness = await RouterTestingHarness.create();
    TestBed.inject(Router).initialNavigation();
  });

  afterEach(clearStorage);

  describe('Inscription', () => {
    it('affiche l’avertissement de démonstration et les champs avec leurs labels', async () => {
      await go('/inscription');
      expect(text()).toContain(
        'Mode démonstration : les comptes ne sont pas enregistrés sur un serveur et cette connexion n’est pas sécurisée.',
      );
      for (const id of ['register-pseudo', 'register-email', 'register-password', 'register-password-confirmation']) {
        expect(root().querySelector(`label[for="${id}"]`)).withContext(id).not.toBeNull();
      }
      expect(el('button[type="submit"]').textContent).toContain('Créer mon compte');
      expect(el('a[href="/connexion"]')).toBeTruthy();
    });

    it('signale les champs obligatoires et place le focus sur le premier', async () => {
      await go('/inscription');
      await submitWithEnter();
      expect(text()).toContain('Le pseudo est obligatoire.');
      expect(text()).toContain('L’adresse e-mail est obligatoire.');
      expect(text()).toContain('Le mot de passe est obligatoire.');
      expect(text()).toContain('Confirmez le mot de passe.');
      expect(el('#register-pseudo').getAttribute('aria-describedby')).toBe('register-pseudo-error');
      expect(document.activeElement?.id).toBe('register-pseudo');
      expect(url()).toBe('/inscription');
    });

    it('vérifie le format de l’e-mail, la longueur et la confirmation, sans effacer la saisie', async () => {
      await go('/inscription');
      type('#register-pseudo', 'Ulrick');
      type('#register-email', 'ulrick@exemple');
      type('#register-password', 'court');
      type('#register-password-confirmation', 'different');
      await submitWithEnter();
      expect(text()).toContain('Saisissez une adresse e-mail valide');
      expect(text()).toContain('au moins 8 caractères');
      expect(text()).toContain('Les deux mots de passe ne correspondent pas.');
      expect(el<HTMLInputElement>('#register-pseudo').value).toBe('Ulrick');
      expect(el<HTMLInputElement>('#register-email').value).toBe('ulrick@exemple');
    });

    it('affiche l’état de chargement puis le profil créé', async () => {
      await go('/inscription');
      type('#register-pseudo', 'Ulrick');
      type('#register-email', 'Ulrick@Exemple.fr');
      type('#register-password', PASSWORD);
      type('#register-password-confirmation', PASSWORD);
      el<HTMLFormElement>('form.account-form').dispatchEvent(new Event('submit', { cancelable: true }));
      harness.detectChanges();
      const button = el<HTMLButtonElement>('button[type="submit"]');
      expect(button.disabled).toBeTrue();
      expect(button.textContent).toContain('Création…');

      await afterLatency();
      expect(url()).toBe('/profil');
      expect(text()).toContain('Ulrick');
      expect(text()).toContain('ulrick@exemple.fr');
      expect(el('time').getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(PASSWORD);
    });

    it('refuse une adresse déjà utilisée en conservant les champs', async () => {
      await register('Ulrick', 'ulrick@exemple.fr');
      await TestBed.inject(AccountStore).logout();
      await register('Autre', 'ulrick@exemple.fr');
      expect(url()).toBe('/inscription');
      expect(text()).toContain('utilise déjà cette adresse');
      expect(el<HTMLInputElement>('#register-pseudo').value).toBe('Autre');
    });

    it('affiche ou masque les mots de passe', async () => {
      await go('/inscription');
      const toggle = el<HTMLButtonElement>('.account-toggle');
      expect(el<HTMLInputElement>('#register-password').type).toBe('password');
      toggle.click();
      await settle();
      expect(el<HTMLInputElement>('#register-password').type).toBe('text');
      expect(el<HTMLInputElement>('#register-password-confirmation').type).toBe('text');
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('Connexion', () => {
    it('valide les champs et refuse un compte inconnu sans effacer la saisie', async () => {
      await go('/connexion');
      await submitWithEnter();
      expect(text()).toContain('L’adresse e-mail est obligatoire.');
      expect(text()).toContain('Le mot de passe est obligatoire.');

      type('#login-email', 'inconnu@exemple.fr');
      type('#login-password', PASSWORD);
      await submitWithEnter();
      expect(text()).toContain('Aucun compte de démonstration n’existe');
      expect(el<HTMLInputElement>('#login-email').value).toBe('inconnu@exemple.fr');
      expect(url()).toBe('/connexion');
    });

    it('parcours complet : inscription → profil → déconnexion → connexion', async () => {
      await register('Ulrick', 'ulrick@exemple.fr');
      expect(url()).toBe('/profil');

      el<HTMLButtonElement>('.account-actions button').click();
      await settle();
      expect(text()).toContain('Vous êtes déconnecté.');
      expect(text()).not.toContain('ulrick@exemple.fr');

      await go('/connexion');
      type('#login-email', 'ULRICK@exemple.fr');
      type('#login-password', PASSWORD);
      await submitWithEnter();
      expect(url()).toBe('/profil');
      expect(text()).toContain('ulrick@exemple.fr');
      expect(root().querySelector('#login-password')).toBeNull();
    });
  });

  describe('Profil', () => {
    it('n’affiche aucun profil à un visiteur non connecté', async () => {
      await go('/profil');
      expect(text()).toContain('Vous n’êtes pas connecté : aucun profil n’est affiché.');
      expect(root().querySelector('.account-profile')).toBeNull();
      expect(el('a[href="/connexion"]')).toBeTruthy();
      expect(el('a[href="/inscription"]')).toBeTruthy();
      expect(text()).toContain('Mode démonstration');
    });
  });

  describe('Menu du grimoire', () => {
    it('propose « Connexion / Inscription » puis « Mon profil » et « Déconnexion »', async () => {
      await go('/?chapitre=accueil');
      expect(el('app-account-menu a[href="/connexion"]').textContent).toContain('Connexion / Inscription');
      expect(el('a.admin-access').getAttribute('href')).toBe('/admin');

      await register('Ulrick', 'ulrick@exemple.fr');
      await go('/?chapitre=accueil');
      expect(el('app-account-menu a[href="/profil"]').textContent).toContain('Mon profil');
      expect(root().querySelector('app-account-menu a[href="/connexion"]')).toBeNull();
      expect(el('a.admin-access').getAttribute('href')).toBe('/admin');

      el<HTMLButtonElement>('app-account-menu button').click();
      await settle();
      expect(TestBed.inject(AccountStore).isLoggedIn()).toBeFalse();
      expect(el('app-account-menu a[href="/connexion"]')).toBeTruthy();
    });

    it('est aussi présent sur une fiche du Lore', async () => {
      await go('/lore/demo-ulrick');
      expect(el('app-account-menu a[href="/connexion"]')).toBeTruthy();
    });

    it('suit le bouton Retour du navigateur', async () => {
      await go('/?chapitre=accueil');
      await go('/connexion');
      await go('/inscription');
      TestBed.inject(Location).back();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await settle();
      expect(url()).toBe('/connexion');
      TestBed.inject(Location).back();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await settle();
      expect(url()).toBe('/?chapitre=accueil');
    });
  });
});
