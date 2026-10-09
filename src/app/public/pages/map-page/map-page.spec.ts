import { TestBed } from '@angular/core/testing';
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

/** Page « Carte du monde » : grimoire, image, marqueurs, fiche, filtres et hiérarchie. */
describe('MapPage', () => {
  let harness: RouterTestingHarness;

  const root = () => harness.fixture.nativeElement as HTMLElement;
  const all = (selector: string) => Array.from(root().querySelectorAll<HTMLElement>(selector));
  const markers = () => all('.world-map-marker');
  const card = () => root().querySelector<HTMLElement>('.map-card');
  /** Texte normalisé, sans le sélecteur de variante (U+FE0E) des symboles. */
  const text = (element: Element | null) =>
    (element?.textContent ?? '').replace(/︎/g, '').replace(/\s+/g, ' ').trim();

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function button(label: string, scope: ParentNode = root()): HTMLButtonElement {
    const found = Array.from(scope.querySelectorAll('button')).find((item) => text(item) === label);
    if (!found) {
      throw new Error(`Bouton introuvable : ${label}`);
    }
    return found;
  }

  function marker(name: string): HTMLElement {
    const found = markers().find((item) => item.getAttribute('aria-label')?.startsWith(`${name},`));
    if (!found) {
      throw new Error(`Marqueur introuvable : ${name}`);
    }
    return found;
  }

  async function click(element: HTMLElement): Promise<void> {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await settle();
  }

  function clearStorage(): void {
    localStorage.removeItem(LORE_STORAGE_KEY);
    localStorage.removeItem(MAP_STORAGE_KEY);
    localStorage.removeItem(BORDER_STORAGE_KEY);
  }

  /** Frontières enregistrées puis page rechargée (nouvel injecteur, données relues). */
  async function reloadWithBorders(showOnPublicMap: boolean, borders: object[]): Promise<void> {
    localStorage.setItem(BORDER_STORAGE_KEY, JSON.stringify({ version: 1, settings: { showOnPublicMap }, borders }));
    TestBed.resetTestingModule();
    configure();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/carte');
    await settle();
  }

  const kingdom = (id: string, change: object = {}) => ({
    id,
    name: `Royaume ${id}`,
    color: '#24485a',
    visible: true,
    isPublic: true,
    points: [{ x: 0.5, y: 0.1 }, { x: 0.8, y: 0.1 }, { x: 0.7, y: 0.4 }],
    ...change,
  });

  const borderPaths = () => all('.leaflet-world-map-borders-pane path');

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
    await harness.navigateByUrl('/carte');
    await settle();
  });

  afterEach(clearStorage);

  it('affiche seulement les frontières publiques et visibles, avec leur légende', async () => {
    expect(borderPaths().length).toBe(0);
    expect(root().querySelector('.map-legend')).toBeNull();

    await reloadWithBorders(true, [kingdom('a'), kingdom('b', { isPublic: false }), kingdom('c', { visible: false })]);
    expect(borderPaths().length).toBe(1);
    expect(all('.map-legend li').map((item) => text(item))).toEqual(['Royaume a']);
    expect(text(root().querySelector('.world-map-border-label'))).toBe('Royaume a');
    // Calque non cliquable : les frontières ne capturent pas les clics du public.
    expect(getComputedStyle(borderPaths()[0]).pointerEvents).toBe('none');
    // Aucun réglage d'administration côté public.
    expect(root().querySelector('#border-name, .map-mode-switch, app-border-panel')).toBeNull();

    // Le visiteur peut masquer le calque.
    await click(root().querySelector<HTMLInputElement>('#map-borders-title + .map-check input')!);
    expect(borderPaths().length).toBe(0);
  });

  it('n’affiche aucune frontière si l’interrupteur général est coupé', async () => {
    await reloadWithBorders(false, [kingdom('a')]);
    expect(borderPaths().length).toBe(0);
    expect(root().querySelector('.map-legend')).toBeNull();
  });

  it('garde les marqueurs cliquables à l’intérieur d’un royaume', async () => {
    await reloadWithBorders(true, [
      kingdom('a', { points: [{ x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.8, y: 0.5 }, { x: 0.5, y: 0.5 }] }),
    ]);
    await click(marker('Hautgivre'));
    expect(text(card()?.querySelector('h3') ?? null)).toBe('Hautgivre');
  });

  it('est accessible depuis le grimoire', async () => {
    await harness.navigateByUrl('/?chapitre=accueil');
    await settle();
    const link = root().querySelector<HTMLAnchorElement>('a[href="/carte"]');
    expect(link).not.toBeNull();

    await click(link!);
    expect(TestBed.inject(Router).url).toBe('/carte');
    expect(text(root().querySelector('#map-title'))).toBe('Carte du monde');
  });

  it('se présente dans le grimoire ouvert, sur le chapitre « Lieux »', () => {
    const book = root().querySelector('.grimoire-book');
    expect(book?.classList).toContain('is-custom');
    expect(book?.querySelector('.left-page .map-index')).not.toBeNull();
    expect(book?.querySelector('.right-page .map-plate app-world-map')).not.toBeNull();
    expect(text(root().querySelector('.book-tab.active'))).toContain('Lieux');
  });

  it('affiche l’image complète en un seul morceau, qui remplit le cadre sans déformation', async () => {
    expect(root().querySelectorAll('img.leaflet-tile').length).toBe(0);
    const images = all('img.leaflet-image-layer') as HTMLImageElement[];
    expect(images.length).toBe(1);
    expect(images[0].getAttribute('src')).toBe('assets/images/Untitled.png');

    const image = images[0].getBoundingClientRect();
    expect(image.width / image.height).toBeCloseTo(2048 / 1778, 2);
    const canvas = root().querySelector<HTMLElement>('.world-map-canvas')!;
    expect(Math.abs(image.width - canvas.clientWidth)).toBeLessThan(2);
    expect(Math.abs(image.height - canvas.clientHeight)).toBeLessThan(2);

    const response = await fetch('assets/images/Untitled.png', { method: 'HEAD' });
    expect(response.ok).toBeTrue();
    expect(response.headers.get('content-type')).toContain('image/png');
  });

  it('affiche les points enregistrés, accessibles au clavier', () => {
    expect(markers().length).toBe(DEMO_MAP_PLACES.length);
    for (const item of markers()) {
      expect(item.getAttribute('tabindex')).toBe('0');
      expect(item.getAttribute('role')).toBe('button');
      expect(item.getAttribute('aria-label')).toBeTruthy();
    }
    expect(text(root().querySelector('.map-demo-notice'))).toContain('ce navigateur');
  });

  it('ouvre la fiche d’un lieu au clic sur son marqueur et la referme', async () => {
    await click(marker('Hautgivre'));

    expect(text(card()?.querySelector('h3') ?? null)).toBe('Hautgivre');
    expect(text(card())).toContain('Capitale');
    expect(text(card())).toContain('exemple');
    expect(text(card())).toContain('Aldoran › Royaume de Hautgivre › Vallées du Nord › Cœur des vallées');
    expect(text(card())).toContain('Aucune fiche publiée');
    expect(card()?.querySelector('a')).toBeNull();
    expect(marker('Hautgivre').classList).toContain('is-selected');
    expect(marker('Hautgivre').getAttribute('aria-pressed')).toBe('true');

    await click(button('✕', card()!));
    expect(card()).toBeNull();
    expect(marker('Hautgivre').classList).not.toContain('is-selected');
  });

  it('referme la fiche avec Échap', async () => {
    await click(marker('Tour du Gué'));
    card()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(card()).toBeNull();
  });

  it('propose un lien vers chaque fiche publiée associée au lieu', async () => {
    await click(marker('Bastion des Nordbriks'));
    const links = card()!.querySelectorAll<HTMLAnchorElement>('a');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('/lore/demo-nordbriks');
    expect(text(links[0])).toBe('Lire la fiche « Nordbriks »');
  });

  it('filtre les marqueurs par type puis revient à tous les lieux', async () => {
    await click(button('♜ Fort'));
    expect(markers().length).toBe(2);
    expect(all('.map-index-section:last-of-type .map-list-item').length).toBe(2);

    await click(button('♛ Capitale'));
    expect(markers().length).toBe(3);

    await click(button('Tous les types'));
    expect(markers().length).toBe(DEMO_MAP_PLACES.length);
  });

  it('descend dans la hiérarchie et met à jour le fil d’Ariane', async () => {
    await click(button('Aldoran 7 lieux'));
    await click(button('Royaume des Sables 3 lieux'));
    expect(all('.map-breadcrumb li').map((item) => text(item))).toEqual([
      'Tous les lieux',
      'Continent Aldoran',
      'Royaume Royaume des Sables',
    ]);
    expect(text(root().querySelector('#map-levels-title'))).toBe('Régions');
    expect(markers().length).toBe(3);

    await click(button('Tous les lieux'));
    expect(markers().length).toBe(DEMO_MAP_PLACES.length);
    expect(text(root().querySelector('#map-levels-title'))).toBe('Continents');
  });

  it('ouvre un lieu depuis la liste', async () => {
    await click(button('◓ Grotte des Braises Grotte'));
    expect(text(card()?.querySelector('h3') ?? null)).toBe('Grotte des Braises');
    expect(marker('Grotte des Braises').classList).toContain('is-selected');
  });

  it('zoome, dézoome et revient à la vue d’ensemble', async () => {
    const zoomOut = button('−');
    expect(zoomOut.disabled).withContext('vue initiale = dézoom maximal').toBeTrue();

    await click(button('+'));
    await new Promise((resolve) => setTimeout(resolve, 400));
    await settle();
    expect(zoomOut.disabled).toBeFalse();

    await click(button('⟲ Vue d’ensemble'));
    await new Promise((resolve) => setTimeout(resolve, 400));
    await settle();
    expect(zoomOut.disabled).toBeTrue();
  });

  it('ne provoque pas de défilement horizontal', () => {
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});
