import { firstValueFrom } from 'rxjs';
import { LORE_STORAGE_KEY, LocalStorageLoreRepository } from './local-storage-lore-repository';

describe('LocalStorageLoreRepository', () => {
  beforeEach(() => localStorage.removeItem(LORE_STORAGE_KEY));
  afterEach(() => localStorage.removeItem(LORE_STORAGE_KEY));

  async function loadNames(): Promise<string[]> {
    const entries = await firstValueFrom(new LocalStorageLoreRepository().findAll());
    return entries.map((entry) => entry.name);
  }

  it('charge les données de démonstration quand le stockage est vide', async () => {
    expect((await loadNames()).length).toBe(6);
  });

  it('retombe sur la démonstration si le JSON est illisible', async () => {
    localStorage.setItem(LORE_STORAGE_KEY, '{pas du json');
    expect(await loadNames()).toContain('Ulrick le Grand');
  });

  it('retombe sur la démonstration si les fiches ont une forme invalide', async () => {
    localStorage.setItem(
      LORE_STORAGE_KEY,
      JSON.stringify([{ id: 'x', name: 'Sans type', relations: [] }]),
    );
    expect(await loadNames()).not.toContain('Sans type');
    localStorage.setItem(LORE_STORAGE_KEY, JSON.stringify({ pas: 'un tableau' }));
    expect((await loadNames()).length).toBe(6);
  });

  it('respecte un Lore volontairement vidé', async () => {
    localStorage.setItem(LORE_STORAGE_KEY, '[]');
    expect(await loadNames()).toEqual([]);
  });

  it('fonctionne en mémoire si localStorage est indisponible', async () => {
    spyOn(localStorage, 'getItem').and.throwError('bloqué');
    spyOn(localStorage, 'setItem').and.throwError('quota');
    const repository = new LocalStorageLoreRepository();
    const created = await firstValueFrom(
      repository.create({ name: 'Éphémère', type: 'Lieu', summary: '', content: '', status: 'Brouillon' }),
    );
    const names = (await firstValueFrom(repository.findAll())).map((entry) => entry.name);
    expect(created.id).toBeTruthy();
    expect(names).toContain('Éphémère');
  });

  it('persiste les modifications entre deux instances (rechargement de page)', async () => {
    const first = new LocalStorageLoreRepository();
    await firstValueFrom(
      first.addRelation('demo-humains', { type: 'est lié à', targetId: 'demo-tranche-horde' }),
    );
    await firstValueFrom(first.delete('demo-nordbriks'));

    const reloaded = await firstValueFrom(new LocalStorageLoreRepository().findAll());
    const humains = reloaded.find((entry) => entry.id === 'demo-humains');
    expect(reloaded.some((entry) => entry.id === 'demo-nordbriks')).toBeFalse();
    expect(humains?.relations.some((r) => r.targetId === 'demo-tranche-horde')).toBeTrue();
  });

  it('signale une erreur pour une fiche inconnue', async () => {
    const repository = new LocalStorageLoreRepository();
    await expectAsync(firstValueFrom(repository.delete('inconnue'))).toBeRejectedWithError(
      'Fiche introuvable.',
    );
    await expectAsync(
      firstValueFrom(repository.removeRelation('inconnue', 'r1')),
    ).toBeRejectedWithError('Fiche introuvable.');
  });
});
