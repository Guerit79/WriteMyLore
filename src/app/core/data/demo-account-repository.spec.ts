import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  DEMO_ACCOUNTS_KEY,
  DEMO_ACCOUNT_LATENCY_MS,
  DEMO_SESSION_KEY,
  DemoAccountRepository,
} from './demo-account-repository';

describe('DemoAccountRepository (mode démonstration)', () => {
  const PASSWORD = 'MotDePasseSecret42';
  let repository: DemoAccountRepository;

  function clearStorage(): void {
    localStorage.removeItem(DEMO_ACCOUNTS_KEY);
    sessionStorage.removeItem(DEMO_SESSION_KEY);
  }

  function everyStoredValue(): string {
    const values: string[] = [document.cookie];
    for (const storage of [localStorage, sessionStorage]) {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i) ?? '';
        values.push(key, storage.getItem(key) ?? '');
      }
    }
    return values.join('\n');
  }

  beforeEach(() => {
    clearStorage();
    TestBed.configureTestingModule({
      providers: [DemoAccountRepository, { provide: DEMO_ACCOUNT_LATENCY_MS, useValue: 0 }],
    });
    repository = TestBed.inject(DemoAccountRepository);
  });

  afterEach(clearStorage);

  it('crée un profil fictif et ouvre la session, sans jamais conserver le mot de passe', async () => {
    const account = await firstValueFrom(
      repository.register({ pseudo: '  Ulrick  ', email: ' Ulrick@Exemple.FR ', password: PASSWORD }),
    );
    expect(account.pseudo).toBe('Ulrick');
    expect(account.email).toBe('ulrick@exemple.fr');
    expect(Date.parse(account.createdAt)).not.toBeNaN();
    expect(Object.keys(account).sort()).toEqual(['createdAt', 'email', 'pseudo']);

    expect(everyStoredValue()).not.toContain(PASSWORD);
    expect(sessionStorage.getItem(DEMO_SESSION_KEY)).toBe('ulrick@exemple.fr');
    expect(await firstValueFrom(repository.restoreSession())).toEqual(account);
  });

  it('refuse une adresse déjà utilisée, quelle que soit la casse', async () => {
    await firstValueFrom(repository.register({ pseudo: 'A', email: 'a@exemple.fr', password: PASSWORD }));
    await expectAsync(
      firstValueFrom(repository.register({ pseudo: 'B', email: 'A@EXEMPLE.FR', password: PASSWORD })),
    ).toBeRejectedWithError(/utilise déjà cette adresse/);
  });

  it('ouvre un compte de démonstration existant et refuse une adresse inconnue', async () => {
    await firstValueFrom(repository.register({ pseudo: 'Ulrick', email: 'u@exemple.fr', password: PASSWORD }));
    await firstValueFrom(repository.logout());
    expect(await firstValueFrom(repository.restoreSession())).toBeNull();

    const account = await firstValueFrom(repository.login({ email: 'U@exemple.fr', password: 'autre-mot' }));
    expect(account.pseudo).toBe('Ulrick');
    expect(everyStoredValue()).not.toContain('autre-mot');

    await expectAsync(
      firstValueFrom(repository.login({ email: 'inconnu@exemple.fr', password: PASSWORD })),
    ).toBeRejectedWithError(/Aucun compte de démonstration/);
  });

  it('ignore un stockage corrompu et ne reprend que les champs d’affichage', async () => {
    localStorage.setItem(DEMO_ACCOUNTS_KEY, '{json cassé');
    sessionStorage.setItem(DEMO_SESSION_KEY, 'x@exemple.fr');
    expect(await firstValueFrom(repository.restoreSession())).toBeNull();

    localStorage.setItem(
      DEMO_ACCOUNTS_KEY,
      JSON.stringify([
        { pseudo: 'X', email: 'x@exemple.fr', createdAt: '2026-01-01T00:00:00.000Z', password: 'fuite' },
        { pseudo: 42 },
      ]),
    );
    const restored = await firstValueFrom(repository.restoreSession());
    expect(restored).toEqual({ pseudo: 'X', email: 'x@exemple.fr', createdAt: '2026-01-01T00:00:00.000Z' });
  });

  it('simule un délai réseau, erreurs comprises', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [DemoAccountRepository, { provide: DEMO_ACCOUNT_LATENCY_MS, useValue: 60 }],
    });
    const slow = TestBed.inject(DemoAccountRepository);
    const start = performance.now();
    await expectAsync(
      firstValueFrom(slow.login({ email: 'inconnu@exemple.fr', password: PASSWORD })),
    ).toBeRejected();
    expect(performance.now() - start).toBeGreaterThanOrEqual(50);
  });
});
