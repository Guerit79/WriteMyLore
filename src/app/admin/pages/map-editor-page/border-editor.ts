import { Injectable, computed, inject, signal } from '@angular/core';
import {
  BORDER_COLORS,
  BORDER_MIN_POINTS,
  BorderStrokeStyle,
  MapBorder,
  MapPoint,
} from '../../../core/models/map-border';
import { MapPosition } from '../../../core/models/world-map';
import { LoreStore, toErrorMessage } from '../../../core/services/lore-store';
import { MapBorderStore } from '../../../core/services/map-border-store';
import { createPlaceId } from '../../../core/services/world-map-store';
import {
  BorderSketch,
  SketchTranslation,
  SketchVertexChange,
} from '../../../shared/components/world-map/world-map-borders';

/** Frontière en cours d'édition (copie de travail : rien n'est enregistré avant « Enregistrer »). */
export interface BorderDraft extends Omit<MapBorder, 'points'> {
  isNew: boolean;
  points: readonly MapPoint[];
  /** Polygone fermé (« Terminer » ou clic sur le premier sommet). */
  closed: boolean;
}

/**
 * - `idle` : frontière sélectionnée (réglages modifiables), carte déplaçable normalement ;
 * - `drawing` : chaque clic sur la carte ajoute un sommet ;
 * - `editing` : poignées affichées (sommets, milieux des côtés, déplacement global).
 */
export type BorderTool = 'idle' | 'drawing' | 'editing';

export interface BorderFeedback {
  kind: 'success' | 'error' | 'info';
  message: string;
}

function toDraft(border: MapBorder): BorderDraft {
  return { ...border, isNew: false, closed: border.points.length >= BORDER_MIN_POINTS };
}

function toBorder(draft: BorderDraft): MapBorder {
  const { isNew: _isNew, closed: _closed, ...border } = draft;
  return { ...border, name: border.name.trim() };
}

function sameBorder(a: MapBorder, b: MapBorder): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * État et actions de l'outil « Gérer les frontières » de l'éditeur de carte.
 * Fourni par la page (une instance par éditeur), partagé avec son panneau et sa carte.
 */
@Injectable()
export class BorderEditor {
  private readonly store = inject(MapBorderStore);
  private readonly loreStore = inject(LoreStore);

  readonly borders = this.store.borders;
  readonly settings = this.store.settings;
  readonly loadError = this.store.loadError;

  readonly draft = signal<BorderDraft | null>(null);
  readonly tool = signal<BorderTool>('idle');
  readonly feedback = signal<BorderFeedback | null>(null);
  readonly confirmDelete = signal(false);
  readonly pending = signal(false);
  /** Affichage des calques dans l'éditeur (réglage de vue, non enregistré). */
  readonly showBordersLayer = signal(true);
  readonly showPlacesLayer = signal(true);

  readonly drawing = computed(() => this.tool() === 'drawing');

  private readonly saved = computed(() => {
    const draft = this.draft();
    return draft && !draft.isNew ? (this.store.findById(draft.id) ?? null) : null;
  });

  readonly dirty = computed(() => {
    const draft = this.draft();
    if (!draft) {
      return false;
    }
    const saved = this.saved();
    return draft.isNew || !saved || !sameBorder(toBorder(draft), saved);
  });

  /** Tracé affiché avec ses poignées (dessin ou modification). */
  readonly sketch = computed<BorderSketch | null>(() => {
    const draft = this.draft();
    if (!draft || this.tool() === 'idle') {
      return null;
    }
    return { points: draft.points, closed: draft.closed, color: draft.color };
  });

  /**
   * Frontières dessinées sur la carte de l'éditeur : la copie de travail remplace la version
   * enregistrée (aperçu des réglages) ; une frontière masquée n'apparaît que si elle est ouverte.
   */
  readonly mapBorders = computed(() => {
    const draft = this.draft();
    const sketching = this.tool() !== 'idle';
    const shown: MapBorder[] = this.store
      .borders()
      .filter((border) => border.id !== draft?.id && border.visible);
    if (draft && !sketching && draft.closed) {
      shown.push(toBorder(draft));
    }
    return shown;
  });

  readonly selectedId = computed(() => this.draft()?.id ?? null);

  /** Fiches proposées pour un royaume : celles de type « Royaume » d'abord. */
  readonly kingdomEntries = computed(() =>
    this.loreStore.entries().filter((entry) => entry.type === 'Royaume').sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  );
  readonly otherEntries = computed(() =>
    this.loreStore.entries().filter((entry) => entry.type !== 'Royaume').sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  );

  // ----- Sélection -----

  newKingdom(): void {
    if (!this.canLeaveDraft()) {
      return;
    }
    const used = new Set(this.store.borders().map((border) => border.color));
    this.draft.set({
      id: createPlaceId(),
      isNew: true,
      name: '',
      loreEntryId: null,
      color: BORDER_COLORS.find((color) => !used.has(color)) ?? BORDER_COLORS[0],
      fillOpacity: 0.15,
      strokeStyle: 'plein',
      strokeWidth: 3,
      visible: true,
      isPublic: false,
      points: [],
      closed: false,
    });
    this.confirmDelete.set(false);
    this.tool.set('drawing');
    this.feedback.set({
      kind: 'info',
      message: 'Tracé en cours : cliquez sur la carte pour poser les sommets, puis « Terminer » (ou cliquez sur le premier sommet).',
    });
  }

  select(id: string): void {
    if (this.draft()?.id === id) {
      return;
    }
    const border = this.store.findById(id);
    if (!border || !this.canLeaveDraft()) {
      return;
    }
    this.draft.set(toDraft(border));
    this.tool.set('idle');
    this.confirmDelete.set(false);
    this.feedback.set(null);
  }

  close(): void {
    if (this.canLeaveDraft()) {
      this.reset();
    }
  }

  /** Clic sur la carte : ajoute un sommet pendant le dessin ; sinon referme une frontière non modifiée. */
  onMapClick(position: MapPosition): void {
    if (this.tool() === 'drawing') {
      this.patch({ points: [...(this.draft()?.points ?? []), { x: position.x / 100, y: position.y / 100 }] });
    } else if (this.tool() === 'idle' && this.draft() && !this.dirty()) {
      this.reset();
    }
  }

  // ----- Tracé -----

  onVertexClick(index: number): void {
    if (this.tool() === 'drawing' && index === 0) {
      this.finish();
    }
  }

  finish(): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    if (draft.points.length < BORDER_MIN_POINTS) {
      this.feedback.set({ kind: 'error', message: `Il faut au moins ${BORDER_MIN_POINTS} sommets pour fermer une frontière.` });
      return;
    }
    this.patch({ closed: true });
    this.tool.set('idle');
    this.feedback.set({
      kind: 'info',
      message: draft.name.trim()
        ? 'Tracé fermé. Vérifiez les réglages puis enregistrez.'
        : 'Tracé fermé. Donnez un nom au royaume puis enregistrez.',
    });
  }

  undoPoint(): void {
    const draft = this.draft();
    if (draft && this.tool() === 'drawing' && draft.points.length > 0) {
      this.patch({ points: draft.points.slice(0, -1) });
    }
  }

  /** Efface le tracé et recommence le dessin (les réglages sont conservés). */
  redraw(): void {
    if (this.draft()) {
      this.patch({ points: [], closed: false });
      this.tool.set('drawing');
      this.feedback.set({ kind: 'info', message: 'Nouveau tracé : cliquez sur la carte pour poser les sommets.' });
    }
  }

  startEditing(): void {
    if (this.draft()?.closed) {
      this.tool.set('editing');
      this.feedback.set({
        kind: 'info',
        message: 'Modification : faites glisser les sommets, les milieux des côtés pour en ajouter, ou ✥ pour déplacer toute la frontière.',
      });
    }
  }

  stopEditing(): void {
    this.tool.set('idle');
    this.feedback.set(null);
  }

  moveVertex({ index, point }: SketchVertexChange): void {
    const draft = this.draft();
    if (draft) {
      this.patch({ points: draft.points.map((item, i) => (i === index ? point : item)) });
    }
  }

  insertVertex({ index, point }: SketchVertexChange): void {
    const draft = this.draft();
    if (draft) {
      this.patch({ points: [...draft.points.slice(0, index), point, ...draft.points.slice(index)] });
    }
  }

  /** Déplace toute la frontière, sans la faire sortir de l'image. */
  translate({ dx, dy }: SketchTranslation): void {
    const draft = this.draft();
    if (!draft || draft.points.length === 0) {
      return;
    }
    const xs = draft.points.map((p) => p.x);
    const ys = draft.points.map((p) => p.y);
    const safeDx = Math.min(1 - Math.max(...xs), Math.max(-Math.min(...xs), dx));
    const safeDy = Math.min(1 - Math.max(...ys), Math.max(-Math.min(...ys), dy));
    this.patch({ points: draft.points.map((p) => ({ x: clamp01(p.x + safeDx), y: clamp01(p.y + safeDy) })) });
  }

  // ----- Réglages -----

  patch(change: Partial<BorderDraft>): void {
    this.draft.update((draft) => (draft ? { ...draft, ...change } : draft));
  }

  setStrokeStyle(style: string): void {
    this.patch({ strokeStyle: style as BorderStrokeStyle });
  }

  /** Crée une fiche « Royaume » (brouillon) au nom du royaume et l'associe à la frontière. */
  async createKingdomEntry(): Promise<void> {
    const name = this.draft()?.name.trim();
    if (!name) {
      this.feedback.set({ kind: 'error', message: 'Donnez d’abord un nom au royaume pour créer sa fiche.' });
      return;
    }
    try {
      const entry = await this.loreStore.create({ name, type: 'Royaume', summary: '', content: '', status: 'Brouillon' });
      this.patch({ loreEntryId: entry.id });
      this.feedback.set({
        kind: 'success',
        message: `Fiche « ${entry.name} » créée en brouillon (à compléter dans le dashboard). Enregistrez la frontière pour garder l’association.`,
      });
    } catch (error) {
      this.feedback.set({ kind: 'error', message: toErrorMessage(error) });
    }
  }

  async setShowOnPublicMap(show: boolean): Promise<void> {
    await this.store.saveSettings({ ...this.settings(), showOnPublicMap: show });
  }

  /** Visibilité depuis la liste : enregistrée tout de suite (ou dans la copie de travail si la frontière est ouverte). */
  async toggleVisible(border: MapBorder): Promise<void> {
    if (this.draft()?.id === border.id) {
      this.patch({ visible: !this.draft()!.visible });
      return;
    }
    await this.store.save({ ...border, visible: !border.visible });
  }

  // ----- Enregistrement -----

  async save(): Promise<void> {
    const draft = this.draft();
    if (!draft || this.pending()) {
      return;
    }
    if (!draft.name.trim()) {
      this.feedback.set({ kind: 'error', message: 'Donnez un nom au royaume avant d’enregistrer.' });
      return;
    }
    if (!draft.closed || draft.points.length < BORDER_MIN_POINTS) {
      this.feedback.set({
        kind: 'error',
        message: `Terminez le tracé (au moins ${BORDER_MIN_POINTS} sommets) avant d’enregistrer.`,
      });
      return;
    }
    this.pending.set(true);
    try {
      const saved = await this.store.save(toBorder(draft));
      this.draft.set(toDraft(saved));
      this.tool.set('idle');
      this.feedback.set({ kind: 'success', message: `Frontière « ${saved.name} » enregistrée dans ce navigateur.` });
    } catch (error) {
      this.feedback.set({ kind: 'error', message: toErrorMessage(error) });
    } finally {
      this.pending.set(false);
    }
  }

  /** Abandonne les modifications non enregistrées (nouveau royaume : il disparaît). */
  cancel(): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    const saved = this.saved();
    if (draft.isNew || !saved) {
      this.reset();
    } else {
      this.draft.set(toDraft(saved));
      this.tool.set('idle');
      this.confirmDelete.set(false);
    }
    this.feedback.set({ kind: 'info', message: 'Modifications annulées.' });
  }

  /** Suppression en deux temps : le premier clic demande confirmation. */
  async remove(): Promise<void> {
    const draft = this.draft();
    if (!draft || draft.isNew) {
      return;
    }
    if (!this.confirmDelete()) {
      this.confirmDelete.set(true);
      return;
    }
    try {
      await this.store.remove(draft.id);
      this.reset();
      this.feedback.set({ kind: 'success', message: `Frontière « ${draft.name} » supprimée.` });
    } catch (error) {
      this.feedback.set({ kind: 'error', message: toErrorMessage(error) });
    }
  }

  /** Quitter la frontière ouverte n'est possible que sans modification en attente. */
  canLeaveDraft(): boolean {
    if (!this.dirty()) {
      return true;
    }
    const name = this.draft()?.name.trim();
    this.feedback.set({
      kind: 'error',
      message: `Enregistrez ou annulez d’abord les modifications de la frontière ${name ? `« ${name} »` : 'en cours'}.`,
    });
    return false;
  }

  private reset(): void {
    this.draft.set(null);
    this.tool.set('idle');
    this.confirmDelete.set(false);
  }
}
