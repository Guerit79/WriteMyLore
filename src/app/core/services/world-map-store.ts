import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { WorldMapRepository } from '../data/world-map-repository';
import { DEMO_GEO_NODES } from '../map/world-map-demo-data';
import { indexGeoNodes } from '../map/world-map-navigation';
import { LoreEntryId } from '../models/lore';
import { GeoNode, MapPlace } from '../models/world-map';

/**
 * Points et hiérarchie de la carte du monde (signals), partagés par la carte publique et l'éditeur.
 * La persistance est déléguée à `WorldMapRepository` (navigateur pour l'instant).
 * La hiérarchie géographique reste une donnée de démonstration, non modifiable.
 */
@Injectable({ providedIn: 'root' })
export class WorldMapStore {
  private readonly repository = inject(WorldMapRepository);
  private readonly placesState = signal<readonly MapPlace[]>([]);
  private readonly loadErrorState = signal<string | null>(null);

  readonly nodes = signal<readonly GeoNode[]>(DEMO_GEO_NODES).asReadonly();
  readonly places = this.placesState.asReadonly();
  readonly loadError = this.loadErrorState.asReadonly();
  readonly nodeLookup = computed(() => indexGeoNodes(this.nodes()));
  readonly hasDemoPlaces = computed(() => this.placesState().some((place) => place.demo));

  /** Point de chaque fiche liée (une fiche est liée à au plus un point). */
  readonly placeByEntryId = computed(() => {
    const index = new Map<LoreEntryId, MapPlace>();
    for (const place of this.placesState()) {
      for (const id of place.loreEntryIds) {
        index.set(id, place);
      }
    }
    return index;
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.repository.findAll().subscribe({
      next: (places) => {
        this.placesState.set(places);
        this.loadErrorState.set(null);
      },
      error: () => this.loadErrorState.set('Impossible de charger les points de la carte.'),
    });
  }

  findById(id: string): MapPlace | undefined {
    return this.placesState().find((place) => place.id === id);
  }

  /** Crée ou remplace un point ; ses fiches quittent leur éventuel ancien point. */
  async save(place: MapPlace): Promise<MapPlace> {
    const places = await firstValueFrom(this.repository.save(place));
    this.placesState.set(places);
    return places.find((item) => item.id === place.id)!;
  }

  async remove(id: string): Promise<void> {
    this.placesState.set(await firstValueFrom(this.repository.delete(id)));
  }
}

/** Identifiant d'un nouveau point (UUID quand le navigateur le permet). */
export function createPlaceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `lieu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
