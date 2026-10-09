import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { AccountRepository } from '../../../core/data/account-repository';
import { DemoAccountRepository } from '../../../core/data/demo-account-repository';
import {
  LORE_STORAGE_KEY,
  LocalStorageLoreRepository,
} from '../../../core/data/local-storage-lore-repository';
import {
  LocalStorageWorldMapRepository,
  MAP_STORAGE_KEY,
} from '../../../core/data/local-storage-world-map-repository';
import { LoreRepository } from '../../../core/data/lore-repository';
import {
  BORDER_STORAGE_KEY,
  LocalStorageMapBorderRepository,
} from '../../../core/data/local-storage-map-border-repository';
import { MapBorderRepository } from '../../../core/data/map-border-repository';
import { WorldMapRepository } from '../../../core/data/world-map-repository';
import { DEMO_MAP_PLACES } from '../../../core/map/world-map-demo-data';
import { MapPlace } from '../../../core/models/world-map';
import { WorldMap } from '../../../shared/components/world-map/world-map';

/** Éditeur de carte : accès depuis le dashboard, fiches, création et association de points. */
describe('MapEditorPage', () => {
  let harness: RouterTestingHarness;

  const root = () => harness.fixture.nativeElement as HTMLElement;
  const all = (selector: string) => Array.from(root().querySelectorAll<HTMLElement>(selector));
  const text = (element: Element | null) =>
    (element?.textContent ?? '').replace(/︎/g, '').replace(/\s+/g, ' ').trim();
  const storedPlaces = (): MapPlace[] => JSON.parse(localStorage.getItem(MAP_STORAGE_KEY) ?? '{"places":[]}').places;

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function go(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    await settle();
  }

  function button(label: string): HTMLButtonElement {
    const found = all('button').find((item) => text(item) === label);
    if (!found) {
      throw new Error(`Bouton introuvable : ${label}`);
    }
    return found as HTMLButtonElement;
  }

  async function click(element: HTMLElement): Promise<void> {
    element.click();
    await settle();
  }

  async function type(selector: string, value: string, event = 'input'): Promise<void> {
    const field = root().querySelector<HTMLInputElement>(selector)!;
    field.value = value;
    field.dispatchEvent(new Event(event));
    await settle();
  }

  function entryRow(name: string): HTMLElement {
    const row = all('.map-entry').find((li) => text(li.querySelector('.map-entry-name')) === name);
    if (!row) {
      throw new Error(`Fiche introuvable dans la liste : ${name}`);
    }
    return row;
  }

  const placeLabel = (name: string) => text(entryRow(name).querySelector('.map-entry-place'));
  const selectEntry = (name: string) => click(entryRow(name).querySelector<HTMLInputElement>('input')!);

  /** Clic sur la carte à une position (en % de l'image), comme le ferait Leaflet. */
  async function clickMap(x: number, y: number): Promise<void> {
    harness.fixture.debugElement.query(By.directive(WorldMap)).componentInstance.mapClick.emit({ x, y });
    await settle();
  }

  function clearStorage(): void {
    localStorage.removeItem(LORE_STORAGE_KEY);
    localStorage.removeItem(MAP_STORAGE_KEY);
    localStorage.removeItem(BORDER_STORAGE_KEY);
  }

  function configure(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        { provide: LoreRepository, useClass: LocalStorageLoreRepository },
        { provide: AccountRepository, useClass: DemoAccountRepository },
        { provide: WorldMapRepository, useClass: LocalStorageWorldMapRepository },
        { provide: MapBorderRepository, useClass: LocalStorageMapBorderRepository },
      ],
    });
  }

  beforeEach(async () => {
    clearStorage();
    configure();
    harness = await RouterTestingHarness.create();
  });

  afterEach(clearStorage);

  it('s’ouvre depuis le dashboard (menu et vue d’ensemble)', async () => {
    await go('/admin');
    expect(root().querySelector('.admin-sidebar a[href="/admin/carte"]')).not.toBeNull();
    const overviewLink = root().querySelector<HTMLAnchorElement>('.admin-main a[href="/admin/carte"]')!;
    expect(text(overviewLink)).toBe('Ouvrir l’éditeur de carte');

    await click(overviewLink);
    // Chargement de la page (route chargée à la demande) puis de la carte.
    await settle();
    expect(TestBed.inject(Router).url).toBe('/admin/carte');
    expect(text(root().querySelector('#map-editor-title'))).toBe('Éditeur de carte');
    // Même grimoire et même carte que la page publique, sans les onglets des chapitres.
    expect(root().querySelector('.grimoire-book.is-custom .right-page app-world-map')).not.toBeNull();
    expect(root().querySelector('.book-tabs')).toBeNull();
    expect(all('.world-map-marker').length).toBe(DEMO_MAP_PLACES.length);
  });

  it('recherche et filtre les fiches, en indiquant leur lieu', async () => {
    await go('/admin/carte');
    expect(all('.map-entry').length).toBe(6);
    expect(placeLabel('Nordbriks')).toContain('Bastion des Nordbriks');
    expect(placeLabel('Ulrick le Grand')).toBe('Sans lieu');

    await type('#map-entry-search', 'ulr');
    expect(all('.map-entry-name').map(text)).toEqual(['Ulrick le Grand']);

    await type('#map-entry-search', '');
    await type('#map-entry-type', 'Race', 'change');
    expect(all('.map-entry-name').map(text)).toEqual(['Humains']);

    await type('#map-entry-type', '', 'change');
    await type('#map-entry-link', 'avec-lieu', 'change');
    expect(all('.map-entry-name').map(text)).toEqual(['Nordbriks']);
  });

  it('crée un point typé pour plusieurs fiches, enregistré dans le navigateur', async () => {
    await go('/admin/carte');
    await selectEntry('Ulrick le Grand');
    await selectEntry('Humains');
    expect(text(root().querySelector('.map-selection strong'))).toBe('2');

    await click(button('Créer un point avec'));
    expect(root().querySelector('.world-map-canvas')?.classList).toContain('is-placing');
    await clickMap(40, 35);
    expect(text(root().querySelector('.map-position'))).toContain('40 % × 35 %');

    await type('#map-point-name', 'Camp d’Ulrick');
    await type('#map-point-type', 'village', 'change');
    expect(root().querySelector('.world-map-marker-village.is-editable')).not.toBeNull();
    await click(button('Enregistrer'));

    const camp = storedPlaces().find((place) => place.name === 'Camp d’Ulrick')!;
    expect(camp.type).toBe('village');
    expect(camp.position).toEqual({ x: 40, y: 35 });
    expect([...camp.loreEntryIds].sort()).toEqual(['demo-humains', 'demo-ulrick']);
    expect(placeLabel('Ulrick le Grand')).toContain('Camp d’Ulrick');
    expect(placeLabel('Humains')).toContain('Camp d’Ulrick');
    expect(placeLabel('Tranche-Horde')).toBe('Sans lieu');

    // Rechargement complet : nouvel injecteur, données relues dans le stockage.
    TestBed.resetTestingModule();
    configure();
    harness = await RouterTestingHarness.create();
    await go('/admin/carte');
    expect(all('.world-map-marker').length).toBe(DEMO_MAP_PLACES.length + 1);
    expect(placeLabel('Ulrick le Grand')).toContain('Camp d’Ulrick');
  });

  it('refuse d’enregistrer un point sans nom ou non placé', async () => {
    await go('/admin/carte');
    await click(button('Nouveau point vide'));
    await click(button('Enregistrer'));
    expect(text(root().querySelector('.map-alert-error'))).toContain('Donnez un nom');

    await type('#map-point-name', 'Sans position');
    await click(button('Enregistrer'));
    expect(text(root().querySelector('.map-alert-error'))).toContain('Placez le point');
    expect(storedPlaces().length).toBe(0);
  });

  it('modifie un point existant et permet d’annuler avant d’enregistrer', async () => {
    await go('/admin/carte');
    harness.fixture.debugElement.query(By.directive(WorldMap)).componentInstance.placeSelect.emit('demo-lieu-hautgivre');
    await settle();
    expect(root().querySelector<HTMLInputElement>('#map-point-name')!.value).toBe('Hautgivre');

    await type('#map-point-name', 'Autre nom');
    await type('#map-point-type', 'donjon', 'change');
    expect(root().querySelector('.map-editor-form .map-tag-warn')).not.toBeNull();
    await click(button('Annuler les modifications'));
    expect(root().querySelector<HTMLInputElement>('#map-point-name')!.value).toBe('Hautgivre');
    expect(root().querySelector('.world-map-marker-capitale')).not.toBeNull();
    // Rien n'a été enregistré.
    expect(localStorage.getItem(MAP_STORAGE_KEY)).toBeNull();
  });

  it('déplace une fiche d’un lieu à un autre (une fiche = un lieu au plus)', async () => {
    await go('/admin/carte');
    harness.fixture.debugElement.query(By.directive(WorldMap)).componentInstance.placeSelect.emit('demo-lieu-hautgivre');
    await settle();
    await selectEntry('Nordbriks');
    await click(button('Ajouter au point ouvert'));
    expect(text(root().querySelector('.map-hint-warn'))).toContain('quittera « Bastion des Nordbriks »');

    await click(button('Enregistrer'));
    const places = storedPlaces();
    expect(places.find((place) => place.id === 'demo-lieu-hautgivre')!.loreEntryIds).toEqual(['demo-nordbriks']);
    expect(places.find((place) => place.id === 'demo-lieu-bastion-nordbrik')!.loreEntryIds).toEqual([]);
    expect(placeLabel('Nordbriks')).toContain('Hautgivre');
  });

  it('retire une fiche de son lieu : elle redevient sans lieu', async () => {
    await go('/admin/carte');
    await click(all('.map-entry-place button')[0]);
    expect(root().querySelector<HTMLInputElement>('#map-point-name')!.value).toBe('Bastion des Nordbriks');

    await click(root().querySelector<HTMLButtonElement>('.map-chip-remove')!);
    await click(button('Enregistrer'));
    expect(placeLabel('Nordbriks')).toBe('Sans lieu');
  });

  it('gère les frontières : tracé, réglages, enregistrement ; les lieux sont verrouillés pendant ce mode', async () => {
    await go('/admin/carte');
    await click(button('⛉ Gérer les frontières'));
    expect(root().querySelector('app-border-panel')).not.toBeNull();
    expect(root().querySelector('.world-map-canvas')?.classList).toContain('places-locked');

    // Un clic (clavier) sur un lieu n'ouvre pas son formulaire dans ce mode.
    const map = harness.fixture.debugElement.query(By.directive(WorldMap)).componentInstance;
    map.placeSelect.emit('demo-lieu-hautgivre');
    await settle();
    expect(root().querySelector('#map-point-name')).toBeNull();

    await click(button('Nouveau royaume'));
    expect(text(root().querySelector('.map-drawing-hint'))).toContain('cliquez pour poser un sommet');
    for (const [x, y] of [[50, 10], [80, 10], [70, 40]]) {
      await clickMap(x, y);
    }
    map.sketchVertexClick.emit(0);
    await settle();
    expect(root().querySelector('.map-drawing-hint')).toBeNull();

    await type('#border-name', 'Royaume de Hautgivre');
    await type('#border-style', 'pointille', 'change');
    await click(button('Enregistrer'));
    const stored = JSON.parse(localStorage.getItem(BORDER_STORAGE_KEY)!).borders;
    expect(stored.length).toBe(1);
    expect(stored[0].name).toBe('Royaume de Hautgivre');
    expect(stored[0].strokeStyle).toBe('pointille');
    expect(stored[0].points).toEqual([{ x: 0.5, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.7, y: 0.4 }]);
    expect(all('.map-border-item').length).toBe(1);
    expect(all('.leaflet-world-map-borders-pane path').length).toBe(1);

    // Retour aux lieux : les marqueurs sont de nouveau actifs.
    await click(button('⌖ Lieux et fiches'));
    expect(root().querySelector('.world-map-canvas')?.classList).not.toContain('places-locked');
  });

  it('refuse de changer d’outil avec une frontière non enregistrée', async () => {
    await go('/admin/carte');
    await click(button('⛉ Gérer les frontières'));
    await click(button('Nouveau royaume'));
    await clickMap(10, 10);
    await click(button('⌖ Lieux et fiches'));
    expect(root().querySelector('app-border-panel')).not.toBeNull();
    expect(text(root().querySelector('.map-alert-error'))).toContain('Enregistrez ou annulez');
  });
});
