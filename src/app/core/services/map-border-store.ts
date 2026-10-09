import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MapBorderRepository } from '../data/map-border-repository';
import {
  DEFAULT_BORDER_SETTINGS,
  MapBorder,
  MapBorderSettings,
  publicBorders,
} from '../models/map-border';

/**
 * Frontières de royaumes et réglages du calque (signals), partagés par la carte publique
 * et l'éditeur. La persistance est déléguée à `MapBorderRepository` (navigateur pour l'instant).
 */
@Injectable({ providedIn: 'root' })
export class MapBorderStore {
  private readonly repository = inject(MapBorderRepository);
  private readonly bordersState = signal<readonly MapBorder[]>([]);
  private readonly settingsState = signal<MapBorderSettings>({ ...DEFAULT_BORDER_SETTINGS });
  private readonly loadErrorState = signal<string | null>(null);

  readonly borders = this.bordersState.asReadonly();
  readonly settings = this.settingsState.asReadonly();
  readonly loadError = this.loadErrorState.asReadonly();
  /** Frontières que le public peut voir (rendues publiques, visibles, interrupteur général actif). */
  readonly publicBorders = computed(() => publicBorders(this.bordersState(), this.settingsState()));

  constructor() {
    this.reload();
  }

  reload(): void {
    this.repository.findAll().subscribe({
      next: (borders) => this.bordersState.set(borders),
      error: () => this.loadErrorState.set('Impossible de charger les frontières.'),
    });
    this.repository.getSettings().subscribe({
      next: (settings) => this.settingsState.set(settings),
      error: () => this.loadErrorState.set('Impossible de charger les réglages des frontières.'),
    });
  }

  findById(id: string): MapBorder | undefined {
    return this.bordersState().find((border) => border.id === id);
  }

  async save(border: MapBorder): Promise<MapBorder> {
    const borders = await firstValueFrom(this.repository.save(border));
    this.bordersState.set(borders);
    return borders.find((item) => item.id === border.id)!;
  }

  async remove(id: string): Promise<void> {
    this.bordersState.set(await firstValueFrom(this.repository.delete(id)));
  }

  async saveSettings(settings: MapBorderSettings): Promise<void> {
    this.settingsState.set(await firstValueFrom(this.repository.saveSettings(settings)));
  }
}
