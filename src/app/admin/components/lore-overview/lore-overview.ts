import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LORE_ENTRY_TYPES } from '../../../core/models/lore';
import { LoreStore } from '../../../core/services/lore-store';
import { WorldMapStore } from '../../../core/services/world-map-store';
import { NEW_ENTRY_PARAM, adminEntryLink } from '../../admin-sections';

@Component({
  selector: 'app-lore-overview',
  imports: [RouterLink],
  templateUrl: './lore-overview.html',
})
export class LoreOverview {
  private readonly store = inject(LoreStore);

  protected readonly stats = this.store.stats;
  protected readonly newEntryParams = { section: 'fiches', fiche: NEW_ENTRY_PARAM };
  protected readonly linkFor = adminEntryLink;

  protected readonly countsByType = computed(() => {
    const entries = this.store.entries();
    return LORE_ENTRY_TYPES.map((type) => ({
      type,
      count: entries.filter((entry) => entry.type === type).length,
    })).filter((item) => item.count > 0);
  });

  private readonly mapStore = inject(WorldMapStore);

  /** Carte du monde : points enregistrés et fiches placées / sans lieu. */
  protected readonly mapStats = computed(() => {
    const entries = this.store.entries();
    const placed = entries.filter((entry) => this.mapStore.placeByEntryId().has(entry.id)).length;
    return { places: this.mapStore.places().length, placed, unplaced: entries.length - placed };
  });

  protected readonly recentEntries = computed(() =>
    [...this.store.entries()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5),
  );
}
