import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import {
  LORE_STORAGE_KEY,
  LocalStorageLoreRepository,
} from '../../../core/data/local-storage-lore-repository';
import { LoreRepository } from '../../../core/data/lore-repository';
import { LocalStorageWorldMapRepository } from '../../../core/data/local-storage-world-map-repository';
import { WorldMapRepository } from '../../../core/data/world-map-repository';
import { LoreStore } from '../../../core/services/lore-store';

/** Parcours du Dashboard joués à travers l'interface (formulaires, boutons, liens). */
describe('Dashboard Lore (parcours)', () => {
  let harness: RouterTestingHarness;
  let store: LoreStore;

  const root = () => harness.fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function go(url: string): Promise<void> {
    await harness.navigateByUrl(url);
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
    const field = el<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector);
    field.value = value;
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? 'change' : 'input'));
  }

  async function click(selector: string): Promise<void> {
    el(selector).click();
    await settle();
  }

  function optionValues(selector: string): string[] {
    return Array.from(el<HTMLSelectElement>(selector).options).map((option) => option.value);
  }

  beforeEach(async () => {
    localStorage.removeItem(LORE_STORAGE_KEY);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        { provide: LoreRepository, useClass: LocalStorageLoreRepository },
        { provide: WorldMapRepository, useClass: LocalStorageWorldMapRepository },
      ],
    });
    harness = await RouterTestingHarness.create();
    store = TestBed.inject(LoreStore);
  });

  afterEach(() => localStorage.removeItem(LORE_STORAGE_KEY));

  it('crée une fiche puis ouvre son éditeur', async () => {
    await go('/admin?section=fiches&fiche=nouvelle');
    type('app-lore-entry-form [formcontrolname="name"]', '  Port-Givre  ');
    type('app-lore-entry-form [formcontrolname="type"]', 'Lieu');
    await click('app-lore-entry-form button[type="submit"]');

    const created = store.entries().find((entry) => entry.name === 'Port-Givre');
    expect(created?.type).toBe('Lieu');
    expect(created?.status).toBe('Brouillon');
    expect(TestBed.inject(Router).url).toBe(`/admin?section=fiches&fiche=${created?.id}`);
    expect(text()).toContain('Fiche « Port-Givre » créée.');
    expect(localStorage.getItem(LORE_STORAGE_KEY)).toContain('Port-Givre');
  });

  it('refuse un formulaire vide ou un nom composé d’espaces', async () => {
    await go('/admin?section=fiches&fiche=nouvelle');
    await click('app-lore-entry-form button[type="submit"]');
    expect(text()).toContain('Le nom est obligatoire.');
    expect(text()).toContain('Le type est obligatoire.');

    type('app-lore-entry-form [formcontrolname="name"]', '    ');
    type('app-lore-entry-form [formcontrolname="type"]', 'Lieu');
    await click('app-lore-entry-form button[type="submit"]');
    expect(text()).toContain('Le nom est obligatoire.');
    expect(store.stats().total).toBe(6);
  });

  it('modifie une fiche existante', async () => {
    await go('/admin?section=fiches&fiche=demo-humains');
    type('app-lore-entry-form [formcontrolname="name"]', 'Humains du Nord');
    await click('app-lore-entry-form button[type="submit"]');
    expect(store.findById('demo-humains')?.name).toBe('Humains du Nord');
    expect(text()).toContain('Fiche « Humains du Nord » enregistrée.');
  });

  it('publie puis repasse une fiche en brouillon', async () => {
    await go('/admin?section=fiches');
    await click('[aria-label="Publier Tranche-Horde"]');
    expect(store.findById('demo-tranche-horde')?.status).toBe('Publié');

    await click('[aria-label="Mettre en brouillon Tranche-Horde"]');
    expect(store.findById('demo-tranche-horde')?.status).toBe('Brouillon');
  });

  it('demande confirmation avant de supprimer et nettoie les relations', async () => {
    await go('/admin?section=fiches');
    await click('[aria-label="Supprimer Nordbriks"]');
    expect(text()).toContain('Supprimer « Nordbriks » et ses relations ?');

    await click('.admin-confirm .admin-btn-ghost');
    expect(store.findById('demo-nordbriks')).toBeDefined();

    await click('[aria-label="Supprimer Nordbriks"]');
    await click('.admin-confirm .admin-btn-danger');
    expect(store.findById('demo-nordbriks')).toBeUndefined();
    expect(store.findById('demo-ulrick')?.relations.some((r) => r.targetId === 'demo-nordbriks')).toBeFalse();
    expect(text()).toContain('Fiche « Nordbriks » supprimée.');
  });

  it('ajoute une relation depuis l’éditeur et refuse le doublon', async () => {
    await go('/admin?section=fiches&fiche=demo-humains');
    const targetSelect = 'app-lore-relation-editor [formcontrolname="targetId"]';
    expect(optionValues(targetSelect)).not.toContain('demo-humains');

    type('app-lore-relation-editor [formcontrolname="type"]', 'est lié à');
    type(targetSelect, 'demo-tranche-horde');
    await settle();
    expect(text()).toContain('Relation associée');
    await click('app-lore-relation-editor app-lore-relation-form button[type="submit"]');
    expect(store.findById('demo-humains')?.relations.some((r) => r.targetId === 'demo-tranche-horde')).toBeTrue();
    expect(text()).toContain('Relation ajoutée');

    type('app-lore-relation-editor [formcontrolname="type"]', 'est lié à');
    type(targetSelect, 'demo-tranche-horde');
    await click('app-lore-relation-editor app-lore-relation-form button[type="submit"]');
    expect(text()).toContain('Cette relation existe déjà.');
  });

  it('retire une relation depuis l’éditeur', async () => {
    await go('/admin?section=fiches&fiche=demo-ulrick');
    await click('[aria-label="Supprimer la relation « possède Tranche-Horde »"]');
    expect(store.findById('demo-ulrick')?.relations.map((r) => r.type)).toEqual([
      'appartient à',
      'dirige',
    ]);
  });

  it('bloque une relation vers soi-même dans la section Relations', async () => {
    await go('/admin?section=relations');
    type('[formcontrolname="sourceId"]', 'demo-humains');
    type('[formcontrolname="type"]', 'est lié à');
    type('[formcontrolname="targetId"]', 'demo-ulrick');
    // La source devient la cible déjà choisie : le validateur doit bloquer l'envoi.
    type('[formcontrolname="sourceId"]', 'demo-ulrick');
    await settle();
    expect(optionValues('[formcontrolname="targetId"]')).not.toContain('demo-ulrick');

    const before = store.stats().relations;
    await click('app-lore-relation-form button[type="submit"]');
    expect(text()).toContain('Une fiche ne peut pas être liée à elle-même.');
    expect(store.stats().relations).toBe(before);
  });

  it('affiche un message pour une fiche inconnue sans planter', async () => {
    await go('/admin?section=fiches&fiche=fiche-inconnue');
    expect(text()).toContain('Fiche introuvable');
    expect(text()).toContain('Cette fiche n’existe pas ou a été supprimée.');
    expect(root().querySelector('app-lore-entry-form')).toBeNull();
  });

  it('revient à la vue d’ensemble pour une section inconnue', async () => {
    await go('/admin?section=inconnue');
    expect(text()).toContain('Fiches par type');
  });

  it('affiche des états vides si le Lore a été vidé', async () => {
    for (const entry of [...store.entries()]) {
      await store.remove(entry.id);
    }
    await go('/admin');
    expect(text()).toContain('Aucune fiche pour le moment.');
    await go('/admin?section=fiches');
    expect(text()).toContain('Aucune fiche ne correspond à ces critères.');
    await go('/admin?section=relations');
    expect(text()).toContain('Aucune relation à afficher.');
  });
});
