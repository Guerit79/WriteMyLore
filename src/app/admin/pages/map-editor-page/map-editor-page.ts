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
import { RouterLink } from '@angular/router';
import { buildGeoPath } from '../../../core/map/world-map-navigation';
import { LORE_ENTRY_TYPES, LoreEntry, LoreEntryType } from '../../../core/models/lore';
import {
  MAP_PLACE_TYPE_DEFINITIONS,
  MapPlace,
  MapPlaceType,
  MapPosition,
  isMapPlaceType,
  mapPlaceType,
} from '../../../core/models/world-map';
import { LoreStore, toErrorMessage } from '../../../core/services/lore-store';
import { WorldMapStore, createPlaceId } from '../../../core/services/world-map-store';
import {
  GRIMOIRE_SINGLE_PAGE_QUERY,
  GrimoireBook,
} from '../../../shared/components/grimoire-book/grimoire-book';
import { MapPlaceMove, WorldMap } from '../../../shared/components/world-map/world-map';
import { adminEntryLink } from '../../admin-sections';
import { BorderEditor } from './border-editor';
import { BorderPanel } from './border-panel';

/** Point en cours d'édition (copie de travail : rien n'est enregistré avant « Enregistrer »). */
interface PlaceDraft {
  id: string;
  isNew: boolean;
  name: string;
  type: MapPlaceType;
  description: string;
  zoneId: string | null;
  /** `null` tant que le nouveau point n'a pas été placé sur la carte. */
  position: MapPosition | null;
  loreEntryIds: readonly string[];
}

type LinkFilter = 'toutes' | 'sans-lieu' | 'avec-lieu';

interface Feedback {
  kind: 'success' | 'error' | 'info';
  message: string;
}

/** Types de fiches qui désignent une étendue plutôt qu'un point précis. */
const AREA_ENTRY_TYPES: readonly LoreEntryType[] = ['Monde', 'Géographie', 'Continent', 'Royaume', 'Région'];

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function toDraft(place: MapPlace): PlaceDraft {
  const { id, name, type, description, zoneId, position, loreEntryIds } = place;
  return { id, isNew: false, name, type, description, zoneId, position, loreEntryIds };
}

function sameDraft(a: PlaceDraft, b: PlaceDraft): boolean {
  return (
    a.name === b.name &&
    a.type === b.type &&
    a.description === b.description &&
    a.zoneId === b.zoneId &&
    a.position?.x === b.position?.x &&
    a.position?.y === b.position?.y &&
    a.loreEntryIds.length === b.loreEntryIds.length &&
    a.loreEntryIds.every((id, index) => id === b.loreEntryIds[index])
  );
}

/**
 * Éditeur de carte (`/admin/carte`) : même grimoire et même carte que la page publique.
 * Page de gauche : point en cours d'édition puis liste des fiches (recherche, sélection multiple,
 * état « sans lieu » / « lié à… »). Page de droite : la carte, où l'on place et déplace les points.
 * Les modifications restent une copie de travail jusqu'à « Enregistrer » (annulables).
 * Accès non sécurisé, comme le reste de l'administration.
 */
@Component({
  selector: 'app-map-editor-page',
  imports: [RouterLink, GrimoireBook, WorldMap, BorderPanel],
  // Outil des frontières : une instance par éditeur, partagée avec son panneau.
  providers: [BorderEditor],
  templateUrl: './map-editor-page.html',
  styleUrl: '../../../public/pages/home-page/home-page.css',
})
export class MapEditorPage {
  private readonly loreStore = inject(LoreStore);
  private readonly mapStore = inject(WorldMapStore);
  private readonly worldMap = viewChild.required(WorldMap);
  private readonly mapElement = viewChild.required(WorldMap, { read: ElementRef });
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly placeTypes = MAP_PLACE_TYPE_DEFINITIONS;
  protected readonly loreTypes = LORE_ENTRY_TYPES;
  protected readonly typeOf = mapPlaceType;
  protected readonly entryLink = adminEntryLink;

  protected readonly search = signal('');
  protected readonly loreType = signal<LoreEntryType | ''>('');
  protected readonly linkFilter = signal<LinkFilter>('toutes');
  protected readonly selectedEntryIds = signal<ReadonlySet<string>>(new Set());
  protected readonly draft = signal<PlaceDraft | null>(null);
  /** Attente d'un clic sur la carte pour (re)placer le point. */
  protected readonly placing = signal(false);
  protected readonly borderEditor = inject(BorderEditor);
  /** Élément modifié : les lieux (et leurs fiches) ou les frontières des royaumes. */
  protected readonly mode = signal<'lieux' | 'frontieres'>('lieux');
  protected readonly confirmDelete = signal(false);
  protected readonly pending = signal(false);
  protected readonly feedback = signal<Feedback | null>(null);
  private readonly singlePage = signal(false);

  protected readonly placeByEntryId = this.mapStore.placeByEntryId;
  protected readonly mapLoadError = this.mapStore.loadError;
  protected readonly loreLoadError = this.loreStore.loadError;

  protected readonly entries = computed(() =>
    [...this.loreStore.entries()].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  );

  protected readonly filteredEntries = computed(() => {
    const search = normalizeText(this.search());
    const type = this.loreType();
    const link = this.linkFilter();
    const placeOf = this.placeByEntryId();
    return this.entries().filter(
      (entry) =>
        (!search || normalizeText(entry.name).includes(search)) &&
        (!type || entry.type === type) &&
        (link === 'toutes' || (link === 'avec-lieu') === placeOf.has(entry.id)),
    );
  });

  protected readonly unlinkedCount = computed(
    () => this.entries().filter((entry) => !this.placeByEntryId().has(entry.id)).length,
  );

  /** Zones de la hiérarchie, avec leur chemin complet comme libellé. */
  protected readonly zones = computed(() => {
    const lookup = this.mapStore.nodeLookup();
    return this.mapStore
      .nodes()
      .filter((node) => node.level === 'Zone')
      .map((node) => ({
        id: node.id,
        label: buildGeoPath(node.id, lookup)
          .map((item) => item.name)
          .join(' › '),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  });

  /** Version enregistrée du point ouvert (pour détecter et annuler les modifications). */
  private readonly savedDraft = computed(() => {
    const draft = this.draft();
    const saved = draft && !draft.isNew ? this.mapStore.findById(draft.id) : undefined;
    return saved ? toDraft(saved) : null;
  });

  protected readonly dirty = computed(() => {
    const draft = this.draft();
    if (!draft) {
      return false;
    }
    const saved = this.savedDraft();
    return draft.isNew || !saved || !sameDraft(draft, saved);
  });

  /** Point affiché pour la copie de travail (dès qu'il a une position). */
  private readonly draftPlace = computed<MapPlace | null>(() => {
    const draft = this.draft();
    if (!draft?.position) {
      return null;
    }
    const { id, name, type, description, zoneId, position, loreEntryIds } = draft;
    return { id, name: name.trim() || 'Nouveau point', type, description, zoneId, position, loreEntryIds };
  });

  /** Points de la carte, avec la copie de travail à la place du point enregistré. */
  protected readonly mapPlaces = computed(() => {
    const places = this.mapStore.places();
    const draft = this.draftPlace();
    if (!draft) {
      return places;
    }
    return places.some((place) => place.id === draft.id)
      ? places.map((place) => (place.id === draft.id ? draft : place))
      : [...places, draft];
  });

  protected readonly editableId = computed(() => this.draftPlace()?.id ?? null);

  protected readonly draftEntries = computed(() =>
    (this.draft()?.loreEntryIds ?? [])
      .map((id) => this.loreStore.findById(id))
      .filter((entry) => entry !== undefined),
  );

  /** Fiches du point ouvert actuellement liées à un autre point : elles le quitteront à l'enregistrement. */
  protected readonly movingEntries = computed(() => {
    const draft = this.draft();
    const placeOf = this.placeByEntryId();
    return this.draftEntries()
      .map((entry) => ({ entry, from: placeOf.get(entry.id) }))
      .filter((item) => item.from !== undefined && item.from.id !== draft?.id)
      .map((item) => ({ entry: item.entry, from: item.from! }));
  });

  protected readonly selectedEntries = computed(() =>
    this.entries().filter((entry) => this.selectedEntryIds().has(entry.id)),
  );

  constructor() {
    const query = window.matchMedia(GRIMOIRE_SINGLE_PAGE_QUERY);
    const update = () => this.singlePage.set(query.matches);
    update();
    query.addEventListener('change', update);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', update));
  }

  // ----- Fiches : recherche et sélection -----

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onLoreType(event: Event): void {
    this.loreType.set((event.target as HTMLSelectElement).value as LoreEntryType | '');
  }

  protected onLinkFilter(event: Event): void {
    this.linkFilter.set((event.target as HTMLSelectElement).value as LinkFilter);
  }

  protected isSelected(entry: LoreEntry): boolean {
    return this.selectedEntryIds().has(entry.id);
  }

  protected toggleEntry(entry: LoreEntry): void {
    this.selectedEntryIds.update((ids) => {
      const next = new Set(ids);
      if (!next.delete(entry.id)) {
        next.add(entry.id);
      }
      return next;
    });
  }

  protected clearSelection(): void {
    this.selectedEntryIds.set(new Set());
  }

  protected inDraft(entry: LoreEntry): boolean {
    return this.draft()?.loreEntryIds.includes(entry.id) ?? false;
  }

  // ----- Points : création, ouverture, édition -----

  /** Nouveau point avec les fiches sélectionnées : il reste à cliquer sur la carte pour le placer. */
  protected createPlace(withSelection: boolean): void {
    if (!this.canLeaveDraft()) {
      return;
    }
    const entries = withSelection ? this.selectedEntries() : [];
    const single = entries.length === 1 ? entries[0] : null;
    this.draft.set({
      id: createPlaceId(),
      isNew: true,
      name: single?.name ?? '',
      type: entries.some((entry) => AREA_ENTRY_TYPES.includes(entry.type)) ? 'region' : 'autre',
      description: single?.summary ?? '',
      zoneId: null,
      position: null,
      loreEntryIds: entries.map((entry) => entry.id),
    });
    if (withSelection) {
      this.clearSelection();
    }
    this.confirmDelete.set(false);
    this.startPlacing();
  }

  /** Ouvre un point existant (clic sur un marqueur ou sur « lié à … » dans la liste). */
  protected openPlace(id: string, focus = false): void {
    const place = this.mapStore.findById(id);
    if (!place || this.draft()?.id === id) {
      if (place && focus) {
        this.worldMap().focusPlace(place);
      }
      return;
    }
    if (!this.canLeaveDraft()) {
      return;
    }
    this.draft.set(toDraft(place));
    this.placing.set(false);
    this.confirmDelete.set(false);
    this.feedback.set(null);
    if (focus) {
      this.worldMap().focusPlace(place);
      this.revealMap();
    } else if (this.singlePage()) {
      // Clic sur un marqueur (téléphone) : le formulaire est sous la carte, on l'amène à l'écran.
      afterNextRender(
        () =>
          this.host.nativeElement
            .querySelector('.map-editor-form')
            ?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
        { injector: this.injector },
      );
    }
  }

  protected patchDraft(change: Partial<PlaceDraft>): void {
    this.draft.update((draft) => (draft ? { ...draft, ...change } : draft));
  }

  protected onName(event: Event): void {
    this.patchDraft({ name: (event.target as HTMLInputElement).value });
  }

  protected onType(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (isMapPlaceType(value)) {
      this.patchDraft({ type: value });
    }
  }

  protected onDescription(event: Event): void {
    this.patchDraft({ description: (event.target as HTMLTextAreaElement).value });
  }

  protected onZone(event: Event): void {
    this.patchDraft({ zoneId: (event.target as HTMLSelectElement).value || null });
  }

  /** Ajoute les fiches sélectionnées au point ouvert. */
  protected addSelectionToDraft(): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    const ids = [...draft.loreEntryIds];
    for (const entry of this.selectedEntries()) {
      if (!ids.includes(entry.id)) {
        ids.push(entry.id);
      }
    }
    this.patchDraft({ loreEntryIds: ids });
    this.clearSelection();
  }

  protected removeEntryFromDraft(entry: LoreEntry): void {
    const draft = this.draft();
    if (draft) {
      this.patchDraft({ loreEntryIds: draft.loreEntryIds.filter((id) => id !== entry.id) });
    }
  }

  protected startPlacing(): void {
    this.placing.set(true);
    const name = this.draft()?.name.trim();
    this.feedback.set({
      kind: 'info',
      message: `Cliquez sur la carte pour placer ${name ? `« ${name} »` : 'le point'}.`,
    });
    this.revealMap();
  }

  protected stopPlacing(): void {
    this.placing.set(false);
    this.feedback.set(null);
    // Nouveau point jamais placé : rien à garder.
    if (this.draft()?.isNew && !this.draft()?.position) {
      this.draft.set(null);
    }
  }

  /** Changer d'outil n'est possible que sans modification en attente dans l'outil quitté. */
  protected setMode(mode: 'lieux' | 'frontieres'): void {
    if (mode === this.mode()) {
      return;
    }
    if (mode === 'frontieres') {
      if (!this.canLeaveDraft()) {
        return;
      }
      this.draft.set(null);
      this.placing.set(false);
      this.confirmDelete.set(false);
      this.feedback.set(null);
    } else {
      if (!this.borderEditor.canLeaveDraft()) {
        return;
      }
      this.borderEditor.close();
      this.borderEditor.feedback.set(null);
    }
    this.mode.set(mode);
  }

  protected onPlaceSelect(id: string): void {
    // Pendant la gestion des frontières, les lieux restent affichés mais ne s'ouvrent pas.
    if (this.mode() === 'lieux') {
      this.openPlace(id);
    }
  }

  protected onAnyMapClick(position: MapPosition): void {
    if (this.mode() === 'frontieres') {
      this.borderEditor.onMapClick(position);
    } else {
      this.onMapClick(position);
    }
  }

  protected onMapClick(position: MapPosition): void {
    const draft = this.draft();
    if (this.placing() && draft) {
      this.patchDraft({ position });
      this.placing.set(false);
      this.feedback.set({
        kind: 'info',
        message: 'Position choisie. Vous pouvez encore glisser le marqueur, puis enregistrer ou annuler.',
      });
    } else if (draft && !this.dirty()) {
      // Clic dans le vide sans modification en cours : on referme le point.
      this.draft.set(null);
    }
  }

  protected onPlaceMove(move: MapPlaceMove): void {
    if (this.draft()?.id === move.id) {
      this.patchDraft({ position: move.position });
    }
  }

  protected async save(): Promise<void> {
    const draft = this.draft();
    if (!draft || this.pending()) {
      return;
    }
    const name = draft.name.trim();
    if (!name) {
      this.feedback.set({ kind: 'error', message: 'Donnez un nom au point avant de l’enregistrer.' });
      return;
    }
    if (!draft.position) {
      this.feedback.set({ kind: 'error', message: 'Placez le point sur la carte avant de l’enregistrer.' });
      return;
    }
    const moved = this.movingEntries();
    this.pending.set(true);
    try {
      const saved = await this.mapStore.save({
        id: draft.id,
        name,
        type: draft.type,
        description: draft.description.trim(),
        zoneId: draft.zoneId,
        position: draft.position,
        loreEntryIds: draft.loreEntryIds,
      });
      this.draft.set(toDraft(saved));
      this.placing.set(false);
      const movedNote = moved
        .map((item) => ` « ${item.entry.name} » a quitté « ${item.from.name} ».`)
        .join('');
      this.feedback.set({
        kind: 'success',
        message: `Point « ${saved.name} » enregistré dans ce navigateur.${movedNote}`,
      });
    } catch (error) {
      this.feedback.set({ kind: 'error', message: toErrorMessage(error) });
    } finally {
      this.pending.set(false);
    }
  }

  /** Abandonne les modifications non enregistrées (nouveau point : il disparaît). */
  protected cancel(): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    this.draft.set(draft.isNew ? null : this.savedDraft());
    this.placing.set(false);
    this.confirmDelete.set(false);
    this.feedback.set({ kind: 'info', message: 'Modifications annulées.' });
  }

  protected closeDraft(): void {
    if (this.canLeaveDraft()) {
      this.draft.set(null);
      this.placing.set(false);
      this.confirmDelete.set(false);
    }
  }

  protected async deletePlace(): Promise<void> {
    const draft = this.draft();
    if (!draft || draft.isNew) {
      return;
    }
    if (!this.confirmDelete()) {
      this.confirmDelete.set(true);
      return;
    }
    try {
      await this.mapStore.remove(draft.id);
      this.draft.set(null);
      this.feedback.set({
        kind: 'success',
        message: `Point « ${draft.name} » supprimé. Ses fiches sont de nouveau sans lieu.`,
      });
    } catch (error) {
      this.feedback.set({ kind: 'error', message: toErrorMessage(error) });
    } finally {
      this.confirmDelete.set(false);
    }
  }

  /** Changer de point est refusé tant que le point ouvert a des modifications non enregistrées. */
  private canLeaveDraft(): boolean {
    if (!this.dirty()) {
      return true;
    }
    const name = this.draft()?.name.trim();
    this.feedback.set({
      kind: 'error',
      message: `Enregistrez ou annulez d’abord les modifications du point ${name ? `« ${name} »` : 'en cours'}.`,
    });
    return false;
  }

  /** Page unique (téléphone) : la carte est au-dessus de la liste, on la ramène à l'écran. */
  private revealMap(): void {
    if (this.singlePage()) {
      afterNextRender(
        () => this.mapElement().nativeElement.scrollIntoView({ block: 'start', behavior: 'smooth' }),
        { injector: this.injector },
      );
    }
  }
}
