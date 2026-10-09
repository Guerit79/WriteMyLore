import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { buildGeoPath, childNodes, filterPlaces, isPlaceWithin } from '../../../core/map/world-map-navigation';
import { MAP_PLACE_TYPES, MapPlace, MapPlaceType, mapPlaceType } from '../../../core/models/world-map';
import { LoreStore } from '../../../core/services/lore-store';
import { MapBorderStore } from '../../../core/services/map-border-store';
import { WorldMapStore } from '../../../core/services/world-map-store';
import {
  GRIMOIRE_SINGLE_PAGE_QUERY,
  GrimoireBook,
} from '../../../shared/components/grimoire-book/grimoire-book';
import { WorldMap } from '../../../shared/components/world-map/world-map';
import { AccountMenu } from '../../components/account-menu/account-menu';
import { publicEntryLink } from '../../public-links';

const GEO_LEVEL_PLURALS = ['Continents', 'Royaumes', 'Régions', 'Zones'] as const;

/**
 * Carte du monde (`/carte`), présentée dans le grimoire ouvert comme l'accueil :
 * page de gauche = index (fiche du lieu, filtres, hiérarchie, liste), page de droite = la carte.
 * Sur téléphone (page unique), la carte vient d'abord et la fiche du lieu se place juste dessous.
 * Styles dans `src/map.css`.
 */
@Component({
  selector: 'app-map-page',
  imports: [RouterLink, NgTemplateOutlet, WorldMap, GrimoireBook, AccountMenu],
  templateUrl: './map-page.html',
  styleUrl: '../home-page/home-page.css',
})
export class MapPage {
  private readonly mapStore = inject(WorldMapStore);
  private readonly loreStore = inject(LoreStore);
  private readonly worldMap = viewChild.required(WorldMap);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly typeOf = mapPlaceType;
  protected readonly hasDemoPlaces = this.mapStore.hasDemoPlaces;
  /** Frontières rendues publiques et visibles (réglages de l'administration, non affichés ici). */
  protected readonly borders = inject(MapBorderStore).publicBorders;
  /** Choix du visiteur : afficher ou masquer le calque des frontières. */
  protected readonly showBorders = signal(true);

  protected readonly selectedNodeId = signal<string | null>(null);
  protected readonly activeTypes = signal<ReadonlySet<MapPlaceType>>(new Set());
  protected readonly selectedPlaceId = signal<string | null>(null);
  /** Page unique (téléphone) : la fiche du lieu passe sous la carte. */
  protected readonly singlePage = signal(false);
  /** Annonce pour les lecteurs d'écran (lieu ouvert, filtre appliqué). */
  protected readonly announcement = signal('');

  /** Types présents sur la carte, dans l'ordre du registre (pas de filtre vide). */
  protected readonly placeTypes = computed(() => {
    const present = new Set(this.mapStore.places().map((place) => place.type));
    return MAP_PLACE_TYPES.filter((type) => present.has(type));
  });

  protected readonly breadcrumb = computed(() =>
    buildGeoPath(this.selectedNodeId(), this.mapStore.nodeLookup()),
  );

  protected readonly visiblePlaces = computed(() =>
    filterPlaces(
      this.mapStore.places(),
      { nodeId: this.selectedNodeId(), types: this.activeTypes() },
      this.mapStore.nodeLookup(),
    ).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  );

  /** Subdivisions du niveau courant, avec le nombre de lieux visibles dans chacune. */
  protected readonly subdivisions = computed(() => {
    const lookup = this.mapStore.nodeLookup();
    const places = filterPlaces(
      this.mapStore.places(),
      { nodeId: null, types: this.activeTypes() },
      lookup,
    );
    return childNodes(this.selectedNodeId(), this.mapStore.nodes()).map((node) => ({
      node,
      count: places.filter((place) => isPlaceWithin(place, node.id, lookup)).length,
    }));
  });

  protected readonly subdivisionLabel = computed(
    () => GEO_LEVEL_PLURALS[this.breadcrumb().length] ?? null,
  );

  /** Lieu ouvert : il disparaît si un filtre le masque. */
  protected readonly selectedPlace = computed(
    () => this.visiblePlaces().find((place) => place.id === this.selectedPlaceId()) ?? null,
  );
  protected readonly selectedPath = computed(() => {
    const place = this.selectedPlace();
    return place ? buildGeoPath(place.zoneId, this.mapStore.nodeLookup()) : [];
  });
  /** Fiches du Lore reliées et publiées (aucun lien vers un brouillon ni lien cassé). */
  protected readonly selectedLoreEntries = computed(() =>
    (this.selectedPlace()?.loreEntryIds ?? [])
      .map((id) => this.loreStore.findPublished(id))
      .filter((entry) => entry !== undefined),
  );
  protected readonly loreLink = publicEntryLink;

  /** Fiche publiée d'un royaume, pour la légende. */
  protected borderEntry(id: string | null) {
    return id ? (this.loreStore.findPublished(id) ?? null) : null;
  }

  /** Élément à refocaliser à la fermeture de la fiche. */
  private returnFocus: HTMLElement | null = null;

  constructor() {
    const query = window.matchMedia(GRIMOIRE_SINGLE_PAGE_QUERY);
    const update = () => this.singlePage.set(query.matches);
    update();
    query.addEventListener('change', update);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', update));
  }

  protected pathLabel(): string {
    return this.selectedPath()
      .map((node) => node.name)
      .join(' › ');
  }

  protected isTypeActive(type: MapPlaceType): boolean {
    return this.activeTypes().has(type);
  }

  /** « Tous les lieux » : aucun filtre, aucune sélection, carte entière. */
  protected showAll(): void {
    this.selectedNodeId.set(null);
    this.activeTypes.set(new Set());
    this.selectedPlaceId.set(null);
    this.worldMap().resetView();
    this.announce('Tous les lieux sont affichés.');
  }

  protected selectNode(nodeId: string | null): void {
    this.selectedNodeId.set(nodeId);
    this.selectedPlaceId.set(null);
    const node = this.breadcrumb().at(-1);
    if (node) {
      this.worldMap().fitPlaces(this.visiblePlaces());
    } else {
      this.worldMap().resetView();
    }
    this.announce(`${node?.name ?? 'Toute la carte'} : ${this.countLabel()}.`);
  }

  protected toggleType(type: MapPlaceType): void {
    this.activeTypes.update((types) => {
      const next = new Set(types);
      if (!next.delete(type)) {
        next.add(type);
      }
      return next;
    });
    this.announce(`${this.countLabel()} affiché${this.visiblePlaces().length > 1 ? 's' : ''}.`);
  }

  protected clearTypes(): void {
    this.activeTypes.set(new Set());
    this.announce(`Tous les types : ${this.countLabel()}.`);
  }

  /** Sélection depuis la liste (`fromList`) : la carte se centre et zoome sur le lieu. */
  protected selectPlace(place: MapPlace | string, fromList: boolean): void {
    const found =
      typeof place === 'string' ? this.visiblePlaces().find((item) => item.id === place) : place;
    if (!found) {
      return;
    }
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.selectedPlaceId.set(found.id);
    afterNextRender(
      () => {
        if (fromList) {
          this.worldMap().focusPlace(found);
        }
        // Page unique : la fiche est sous la carte, on la fait apparaître sans perdre la carte de vue.
        if (this.singlePage()) {
          this.host.nativeElement.querySelector('.map-card')?.scrollIntoView({ block: 'nearest' });
        }
      },
      { injector: this.injector },
    );
    this.announce(`${found.name}, ${mapPlaceType(found.type).label.toLowerCase()} : fiche ouverte.`);
  }

  protected closeCard(): void {
    if (!this.selectedPlaceId()) {
      return;
    }
    this.selectedPlaceId.set(null);
    this.returnFocus?.focus({ preventScroll: true });
    this.returnFocus = null;
  }

  protected countLabel(): string {
    const count = this.visiblePlaces().length;
    return count === 0 ? 'aucun lieu' : `${count} lieu${count > 1 ? 'x' : ''}`;
  }

  private announce(message: string): void {
    this.announcement.set(message);
  }
}
