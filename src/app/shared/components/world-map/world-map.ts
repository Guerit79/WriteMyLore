import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { WORLD_MAP_IMAGE } from '../../../core/map/world-map-config';
import { MapBorder, MapPoint } from '../../../core/models/map-border';
import { MapPlace, MapPosition, mapPlaceType } from '../../../core/models/world-map';
import {
  BorderLayer,
  BorderSketch,
  SketchTranslation,
  SketchVertexChange,
} from './world-map-borders';

/**
 * Zoom 0 = image à sa taille réelle (1 pixel de l'image par pixel d'écran) ; chaque niveau
 * en dessous divise la taille par deux, chaque niveau au-dessus la double.
 */
const NATIVE_ZOOM = 0;
/** Un niveau au-delà de la taille réelle : les détails restent lisibles sur un petit écran. */
const MAX_ZOOM = NATIVE_ZOOM + 1;
/** Agrandissement (en niveaux, depuis la vue d'ensemble) quand on centre la carte sur un lieu. */
const PLACE_FOCUS_STEPS = 1.5;
const MARKER_SIZE = 34;
const PAN_PADDING = 48;

/** Déplacement d'un marqueur à la souris (mode édition). */
export interface MapPlaceMove {
  id: string;
  position: MapPosition;
}

/**
 * Carte illustrée interactive (Leaflet, `CRS.Simple`) : l'image est un plan sans coordonnées
 * géographiques. L'image complète est affichée en un seul morceau (`ImageOverlay`) aux dimensions
 * réelles du fichier, dans un cadre aux mêmes proportions (aucune bande vide, aucun recadrage).
 * Les lieux sont positionnés en pourcentage de l'image : ils restent alignés quel que soit
 * le zoom ou la taille de l'écran.
 * Utilisée par la carte publique et par l'éditeur (`placing`, `editableId`, `placeMove`).
 * Calque des frontières (`borders`, `borderSketch`…) : polygones SVG au-dessus de l'image et
 * sous les lieux, voir `world-map-borders.ts`. Sommets normalisés entre 0 et 1.
 * Contenu projeté : `[mapToolbarStart]` / `[mapToolbarEnd]` autour des boutons de zoom,
 * `[mapOverlay]` au-dessus de la carte.
 */
@Component({
  selector: 'app-world-map',
  templateUrl: './world-map.html',
  // Proportions de l'image, pour que le parent dimensionne la carte sans la déformer.
  host: { '[style.--world-map-ratio]': 'ratio' },
})
export class WorldMap {
  /** Lieux à afficher (déjà filtrés par la page). */
  readonly places = input.required<readonly MapPlace[]>();
  readonly selectedId = input<string | null>(null);
  /** Part de la hauteur de la carte couverte en bas par une fiche superposée (0 à 1). */
  readonly bottomInset = input(0);
  /** Mode « placement » : curseur en croix, un clic donne une position (`mapClick`). */
  readonly placing = input(false);
  /** Marqueur déplaçable à la souris (édition), `null` sinon. */
  readonly editableId = input<string | null>(null);

  /** Frontières de royaumes à afficher (déjà filtrées par la page). */
  readonly borders = input<readonly MapBorder[]>([]);
  /** Calque des frontières affiché. */
  readonly bordersVisible = input(true);
  readonly selectedBorderId = input<string | null>(null);
  /** Frontières cliquables (gestion des frontières, hors dessin). */
  readonly borderSelectable = input(false);
  /** Tracé en cours (dessin ou modification), avec ses poignées. */
  readonly borderSketch = input<BorderSketch | null>(null);
  /** Calque des lieux affiché. */
  readonly placesVisible = input(true);
  /** Lieux cliquables (désactivé pendant la gestion des frontières). */
  readonly placesInteractive = input(true);

  readonly placeSelect = output<string>();
  /** Clic sur la carte hors des marqueurs, avec sa position en pourcentage de l'image. */
  readonly mapClick = output<MapPosition>();
  readonly placeMove = output<MapPlaceMove>();
  readonly borderSelect = output<string>();
  /** Clic sur un sommet du tracé (le premier ferme le polygone pendant le dessin). */
  readonly sketchVertexClick = output<number>();
  readonly sketchVertexMove = output<SketchVertexChange>();
  /** Nouveau sommet inséré à `index` (milieu d'un côté glissé ou cliqué). */
  readonly sketchVertexInsert = output<SketchVertexChange>();
  readonly sketchTranslate = output<SketchTranslation>();

  private readonly zone = inject(NgZone);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('canvas');

  private map?: L.Map;
  private borderLayer?: BorderLayer;
  private imageBounds?: L.LatLngBounds;
  /** Marqueurs affichés, avec le lieu qu'ils représentent (pour ne mettre à jour que le nécessaire). */
  private readonly markers = new Map<string, { marker: L.Marker; place: MapPlace }>();
  private readonly ready = signal(false);

  protected readonly zoom = signal(0);
  protected readonly minZoom = signal(0);
  protected readonly maxZoom = MAX_ZOOM;
  protected readonly ratio = WORLD_MAP_IMAGE.width / WORLD_MAP_IMAGE.height;
  /** Proportions du cadre = proportions de l'image. */
  protected readonly aspectRatio = `${WORLD_MAP_IMAGE.width} / ${WORLD_MAP_IMAGE.height}`;
  /** Chargement de l'illustration (un message s'affiche en attendant). */
  protected readonly imageState = signal<'loading' | 'loaded' | 'error'>('loading');

  constructor() {
    afterNextRender(() => this.zone.runOutsideAngular(() => this.createMap()));

    // Marqueurs synchronisés avec les lieux, la sélection et l'édition (sans tout recréer : le focus clavier reste).
    effect(() => {
      const places = this.places();
      const selectedId = this.selectedId();
      const editableId = this.editableId();
      if (this.ready()) {
        untracked(() =>
          this.zone.runOutsideAngular(() => this.syncMarkers(places, selectedId, editableId)),
        );
      }
    });

    // Fiche superposée : on peut faire remonter le bas de l'image au-dessus d'elle.
    effect(() => {
      this.bottomInset();
      if (this.ready()) {
        untracked(() => this.zone.runOutsideAngular(() => this.updateMaxBounds()));
      }
    });

    // Lieu sélectionné : la carte se déplace juste assez pour qu'il reste visible.
    effect(() => {
      const selectedId = this.selectedId();
      if (this.ready() && selectedId) {
        untracked(() => this.zone.runOutsideAngular(() => this.revealPlace(selectedId)));
      }
    });

    // Calque des frontières : redessiné quand les frontières, la sélection ou le mode changent.
    effect(() => {
      const borders = this.borders();
      const options = {
        selectedId: this.selectedBorderId(),
        selectable: this.borderSelectable(),
        visible: this.bordersVisible(),
      };
      if (this.ready()) {
        untracked(() => this.zone.runOutsideAngular(() => this.borderLayer?.renderBorders(borders, options)));
      }
    });

    effect(() => {
      const sketch = this.borderSketch();
      if (this.ready()) {
        untracked(() => this.zone.runOutsideAngular(() => this.borderLayer?.renderSketch(sketch)));
      }
    });

    inject(DestroyRef).onDestroy(() => this.map?.remove());
  }

  zoomIn(): void {
    this.map?.zoomIn();
  }

  zoomOut(): void {
    this.map?.zoomOut();
  }

  /** Vue d'ensemble : toute l'image. */
  resetView(): void {
    if (this.map && this.imageBounds) {
      this.map.fitBounds(this.imageBounds, { animate: this.animate() });
    }
  }

  /** Centre la carte sur une position, en zoomant si la vue est trop large. */
  focusPosition(position: MapPosition): void {
    const map = this.map;
    if (!map) {
      return;
    }
    const zoom = Math.max(map.getZoom(), this.focusZoom());
    // Le lieu est centré dans la partie de la carte qui n'est pas couverte par la fiche.
    const offset = (map.getSize().y * this.bottomInset()) / 2;
    const center = map.unproject(map.project(this.toLatLng(position), zoom).add([0, offset]), zoom);
    map.setView(center, zoom, { animate: this.animate() });
  }

  focusPlace(place: MapPlace): void {
    this.focusPosition(place.position);
  }

  /** Cadre la carte sur un ensemble de lieux (vue d'ensemble s'il n'y en a aucun). */
  fitPlaces(places: readonly MapPlace[]): void {
    const map = this.map;
    if (!map || places.length === 0) {
      this.resetView();
      return;
    }
    if (places.length === 1) {
      this.focusPlace(places[0]);
      return;
    }
    const bounds = L.latLngBounds(places.map((place) => this.toLatLng(place.position)));
    map.fitBounds(bounds, {
      padding: [PAN_PADDING, PAN_PADDING],
      maxZoom: this.focusZoom(),
      animate: this.animate(),
    });
  }

  private createMap(): void {
    const { url, width, height } = WORLD_MAP_IMAGE;
    const map = L.map(this.container().nativeElement, {
      crs: L.CRS.Simple,
      zoomControl: false,
      attributionControl: false,
      // Zoom continu : la vue d'ensemble remplit exactement le cadre (pas d'arrondi au quart de niveau).
      zoomSnap: 0,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 120,
      // Sans calque de tuiles, Leaflet bloque le dézoom à 0 : l'image ne pourrait pas être réduite
      // pour tenir dans le cadre. Limite provisoire très basse, recalculée par updateMinZoom().
      minZoom: -10,
      maxZoom: this.maxZoom,
      maxBoundsViscosity: 1,
    });

    // Coin haut-gauche (0, 0) et coin bas-droit de l'image, en pixels de l'image (zoom natif).
    const bounds = L.latLngBounds(
      map.unproject([0, height], NATIVE_ZOOM),
      map.unproject([width, 0], NATIVE_ZOOM),
    );
    this.imageBounds = bounds;

    L.imageOverlay(url, bounds, { alt: '' })
      .on('load', () => this.zone.run(() => this.imageState.set('loaded')))
      .on('error', () => this.zone.run(() => this.imageState.set('error')))
      .addTo(map);

    map.setMaxBounds(bounds);
    map.on('zoomend', () => {
      this.updateMaxBounds();
      this.zone.run(() => this.zoom.set(map.getZoom()));
    });
    map.on('click', (event: L.LeafletMouseEvent) => {
      const position = this.toPosition(event.latlng);
      if (position) {
        this.zone.run(() => this.mapClick.emit(position));
      }
    });

    this.map = map;
    this.borderLayer = new BorderLayer(
      map,
      { toLatLng: (point) => this.toLatLngNormalized(point), toPoint: (latlng) => this.toNormalized(latlng) },
      {
        borderSelect: (id) => this.zone.run(() => this.borderSelect.emit(id)),
        vertexClick: (index) => this.zone.run(() => this.sketchVertexClick.emit(index)),
        vertexMove: (change) => this.zone.run(() => this.sketchVertexMove.emit(change)),
        vertexInsert: (change) => this.zone.run(() => this.sketchVertexInsert.emit(change)),
        translate: (translation) => this.zone.run(() => this.sketchTranslate.emit(translation)),
      },
    );
    this.updateMinZoom();
    map.fitBounds(bounds, { animate: false });

    // Taille du conteneur modifiée (rotation du téléphone, mise en page) : la carte se recale.
    const observer = new ResizeObserver(() => {
      // Vue d'ensemble avant le redimensionnement : elle est recalculée pour la nouvelle taille.
      const wasOverview = map.getZoom() <= this.minZoom() + 0.01;
      map.invalidateSize({ animate: false });
      this.updateMinZoom();
      if (wasOverview) {
        map.fitBounds(bounds, { animate: false });
      }
    });
    observer.observe(this.container().nativeElement);
    map.on('unload', () => observer.disconnect());

    this.zone.run(() => {
      this.zoom.set(map.getZoom());
      this.ready.set(true);
    });
  }

  /** Dézoom limité à l'image entière : on ne se perd jamais hors de la carte. */
  private updateMinZoom(): void {
    const map = this.map;
    if (!map || !this.imageBounds) {
      return;
    }
    // Calcul direct (au zoom 0, 1 pixel d'image = 1 pixel d'écran) : `getBoundsZoom` est borné
    // par le zoom minimal courant et ne pourrait pas descendre quand le cadre rétrécit.
    const size = map.getSize();
    const { width, height } = WORLD_MAP_IMAGE;
    const fitZoom = NATIVE_ZOOM + Math.log2(Math.min(size.x / width, size.y / height));
    const minZoom = Math.min(fitZoom, this.maxZoom);
    map.setMinZoom(minZoom);
    this.zone.run(() => this.minZoom.set(minZoom));
  }

  /**
   * Limites de déplacement : l'image entière, prolongée vers le bas de la hauteur couverte
   * par une fiche superposée (sinon un lieu situé en bas de l'image resterait caché dessous).
   */
  private updateMaxBounds(): void {
    const map = this.map;
    const bounds = this.imageBounds;
    if (!map || !bounds) {
      return;
    }
    const covered = map.getSize().y * this.bottomInset();
    if (covered === 0) {
      map.setMaxBounds(bounds);
      return;
    }
    // Pixels à l'écran → unités de la carte au zoom courant (CRS.Simple : 2^zoom pixels par unité).
    const extra = covered / map.getZoomScale(map.getZoom(), 0);
    map.setMaxBounds(
      L.latLngBounds([bounds.getSouth() - extra, bounds.getWest()], bounds.getNorthEast()),
    );
  }

  private syncMarkers(
    places: readonly MapPlace[],
    selectedId: string | null,
    editableId: string | null,
  ): void {
    const map = this.map;
    if (!map) {
      return;
    }
    const visibleIds = new Set(places.map((place) => place.id));
    for (const [id, { marker }] of this.markers) {
      if (!visibleIds.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }

    for (const place of places) {
      let shown = this.markers.get(place.id);
      if (!shown) {
        shown = { marker: this.createMarker(place).addTo(map), place };
        this.markers.set(place.id, shown);
      } else if (shown.place !== place) {
        this.updateMarker(shown.marker, shown.place, place);
        shown.place = place;
      }
      const { marker } = shown;
      const selected = place.id === selectedId;
      marker.setZIndexOffset(selected ? 1000 : 0);
      const element = marker.getElement();
      element?.classList.toggle('is-selected', selected);
      element?.classList.toggle('is-editable', place.id === editableId);
      element?.setAttribute('aria-pressed', String(selected));
      if (place.id === editableId) {
        marker.dragging?.enable();
      } else {
        marker.dragging?.disable();
      }
    }
  }

  private createMarker(place: MapPlace): L.Marker {
    const marker = L.marker(this.toLatLng(place.position), {
      icon: this.iconFor(place),
      // Focus au clavier (Tab) et activation par Entrée, gérés par Leaflet.
      keyboard: true,
      title: this.titleFor(place),
      riseOnHover: true,
    });
    marker.on('click', () => this.zone.run(() => this.placeSelect.emit(place.id)));
    marker.on('add', () => marker.getElement()?.setAttribute('aria-label', this.labelFor(place)));
    marker.on('dragend', () => {
      const position = this.toPosition(marker.getLatLng());
      if (position) {
        this.zone.run(() => this.placeMove.emit({ id: place.id, position }));
      }
    });
    return marker;
  }

  /** Lieu modifié (édition) : position, symbole et libellés mis à jour sur le marqueur existant. */
  private updateMarker(marker: L.Marker, previous: MapPlace, place: MapPlace): void {
    if (previous.position.x !== place.position.x || previous.position.y !== place.position.y) {
      marker.setLatLng(this.toLatLng(place.position));
    }
    if (previous.type !== place.type || previous.name !== place.name) {
      marker.setIcon(this.iconFor(place));
      const element = marker.getElement();
      element?.setAttribute('title', this.titleFor(place));
      element?.setAttribute('aria-label', this.labelFor(place));
    }
  }

  private iconFor(place: MapPlace): L.DivIcon {
    const type = mapPlaceType(place.type);
    return L.divIcon({
      className: `world-map-marker world-map-marker-${type.id}`,
      html: `<span class="world-map-marker-glyph" style="--place-color: ${type.color}" aria-hidden="true">${type.glyph}</span>`,
      iconSize: [MARKER_SIZE, MARKER_SIZE],
      iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
    });
  }

  private titleFor(place: MapPlace): string {
    return `${place.name} (${mapPlaceType(place.type).label})`;
  }

  private labelFor(place: MapPlace): string {
    return `${place.name}, ${mapPlaceType(place.type).label.toLowerCase()}`;
  }

  private revealPlace(id: string): void {
    const map = this.map;
    const marker = this.markers.get(id)?.marker;
    if (!map || !marker) {
      return;
    }
    const covered = map.getSize().y * this.bottomInset();
    map.panInside(marker.getLatLng(), {
      paddingTopLeft: [PAN_PADDING, PAN_PADDING],
      paddingBottomRight: [PAN_PADDING, PAN_PADDING + covered],
      animate: this.animate(),
    });
  }

  private focusZoom(): number {
    return Math.min(this.minZoom() + PLACE_FOCUS_STEPS, this.maxZoom);
  }

  private toLatLng(position: MapPosition): L.LatLng {
    const { width, height } = WORLD_MAP_IMAGE;
    return this.map!.unproject([(position.x / 100) * width, (position.y / 100) * height], NATIVE_ZOOM);
  }

  /** Point normalisé (0 à 1) → coordonnées Leaflet. */
  private toLatLngNormalized(point: MapPoint): L.LatLng {
    const { width, height } = WORLD_MAP_IMAGE;
    return this.map!.unproject([point.x * width, point.y * height], NATIVE_ZOOM);
  }

  /** Coordonnées Leaflet → point normalisé (0 à 1), ramené dans l'image. */
  private toNormalized(latlng: L.LatLng): MapPoint {
    const { width, height } = WORLD_MAP_IMAGE;
    const point = this.map!.project(latlng, NATIVE_ZOOM);
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    return { x: clamp(point.x / width), y: clamp(point.y / height) };
  }

  /** Coordonnées Leaflet → pourcentage de l'image (`null` hors de l'image). */
  private toPosition(latlng: L.LatLng): MapPosition | null {
    const { width, height } = WORLD_MAP_IMAGE;
    const point = this.map!.project(latlng, NATIVE_ZOOM);
    const x = (point.x / width) * 100;
    const y = (point.y / height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) {
      return null;
    }
    // Deux décimales : précision bien inférieure au pixel, stockage lisible.
    return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
  }

  private animate(): boolean {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
