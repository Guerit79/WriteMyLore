import { TestBed } from '@angular/core/testing';
import {
  LORE_STORAGE_KEY,
  LocalStorageLoreRepository,
} from '../data/local-storage-lore-repository';
import { LoreRepository } from '../data/lore-repository';
import { LoreStore } from './lore-store';

describe('LoreStore', () => {
  let store: LoreStore;

  beforeEach(() => {
    localStorage.removeItem(LORE_STORAGE_KEY);
    TestBed.configureTestingModule({
      providers: [{ provide: LoreRepository, useClass: LocalStorageLoreRepository }],
    });
    store = TestBed.inject(LoreStore);
  });

  afterEach(() => localStorage.removeItem(LORE_STORAGE_KEY));

  it('charge les données de démonstration', () => {
    expect(store.stats().total).toBe(6);
    expect(store.stats().drafts).toBe(1);
  });

  it('crée une fiche et la persiste dans localStorage', async () => {
    const created = await store.create({
      name: '  Port-Givre ',
      type: 'Lieu',
      summary: '',
      content: '',
      status: 'Brouillon',
    });
    expect(created.name).toBe('Port-Givre');
    expect(localStorage.getItem(LORE_STORAGE_KEY)).toContain('Port-Givre');
  });

  it('refuse une relation vers la fiche elle-même', async () => {
    await expectAsync(
      store.addRelation('demo-ulrick', { type: 'est lié à', targetId: 'demo-ulrick' }),
    ).toBeRejectedWithError('Une fiche ne peut pas être liée à elle-même.');
  });

  it('refuse une relation en double', async () => {
    await expectAsync(
      store.addRelation('demo-ulrick', { type: 'possède', targetId: 'demo-tranche-horde' }),
    ).toBeRejectedWithError('Cette relation existe déjà.');
  });

  it('supprime les relations qui ciblent une fiche supprimée', async () => {
    await store.remove('demo-tranche-horde');
    const ulrick = store.findById('demo-ulrick');
    expect(ulrick?.relations.some((r) => r.targetId === 'demo-tranche-horde')).toBeFalse();
  });

  it('publie ou repasse une fiche en brouillon', async () => {
    const published = await store.setStatus('demo-tranche-horde', 'Publié');
    expect(published.status).toBe('Publié');
    expect(store.stats().drafts).toBe(0);
    expect(store.findPublished('demo-tranche-horde')).toBeDefined();

    await store.setStatus('demo-tranche-horde', 'Brouillon');
    expect(store.findPublished('demo-tranche-horde')).toBeUndefined();
    expect(store.findById('demo-tranche-horde')).toBeDefined();
  });

  it('modifie une fiche en conservant ses relations', async () => {
    const updated = await store.update('demo-ulrick', {
      name: 'Ulrick le Très Grand',
      type: 'Personnage',
      summary: 'Résumé',
      content: 'Contenu',
      status: 'Publié',
    });
    expect(updated.name).toBe('Ulrick le Très Grand');
    expect(updated.relations.length).toBe(3);
  });

  it('refuse une relation vers une fiche inexistante', async () => {
    await expectAsync(
      store.addRelation('demo-ulrick', { type: 'est lié à', targetId: 'fiche-fantome' }),
    ).toBeRejectedWithError('La fiche cible est introuvable.');
  });

  it('refuse les opérations sur une fiche inconnue sans altérer les données', async () => {
    const input = { name: 'X', type: 'Lieu', summary: '', content: '', status: 'Brouillon' } as const;
    await expectAsync(store.update('inconnue', input)).toBeRejectedWithError('Fiche introuvable.');
    await expectAsync(store.remove('inconnue')).toBeRejectedWithError('Fiche introuvable.');
    await expectAsync(
      store.addRelation('inconnue', { type: 'possède', targetId: 'demo-ulrick' }),
    ).toBeRejectedWithError('Fiche introuvable.');
    expect(store.stats().total).toBe(6);
  });

  it('ajoute puis retire une relation', async () => {
    const withRelation = await store.addRelation('demo-humains', {
      type: 'participe à',
      targetId: 'demo-nordbriks',
    });
    const relation = withRelation.relations.find((r) => r.targetId === 'demo-nordbriks');
    expect(relation).toBeDefined();

    const without = await store.removeRelation('demo-humains', relation?.id ?? '');
    expect(without.relations.some((r) => r.targetId === 'demo-nordbriks')).toBeFalse();
  });

  it('nettoie les relations entrantes et sortantes d’une fiche supprimée', async () => {
    // Nordbriks : 1 relation sortante (→ Nordiens) et 2 entrantes (Ulrick appartient à / dirige).
    const before = store.stats().relations;
    await store.remove('demo-nordbriks');
    const ulrick = store.findById('demo-ulrick');
    expect(ulrick?.relations.map((r) => r.type)).toEqual(['possède']);
    expect(store.relations().some((view) => view.target.id === 'demo-nordbriks')).toBeFalse();
    expect(store.stats().relations).toBe(before - 3);
  });

  it('ne publie que les fiches publiées dans l’index public', () => {
    const publicIds = [...store.publishedLookup().keys()];
    expect(publicIds).not.toContain('demo-tranche-horde');
    expect(publicIds.length).toBe(5);
  });
});
