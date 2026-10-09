import { TestBed } from '@angular/core/testing';
import {
  LORE_STORAGE_KEY,
  LocalStorageLoreRepository,
} from '../../../core/data/local-storage-lore-repository';
import {
  BORDER_STORAGE_KEY,
  LocalStorageMapBorderRepository,
} from '../../../core/data/local-storage-map-border-repository';
import { LoreRepository } from '../../../core/data/lore-repository';
import { MapBorderRepository } from '../../../core/data/map-border-repository';
import { LocalStorageWorldMapRepository } from '../../../core/data/local-storage-world-map-repository';
import { WorldMapRepository } from '../../../core/data/world-map-repository';
import { LoreStore } from '../../../core/services/lore-store';
import { MapBorderStore } from '../../../core/services/map-border-store';
import { polygonCentroid } from '../../../shared/components/world-map/world-map-borders';
import { BorderEditor } from './border-editor';

describe('BorderEditor', () => {
  let editor: BorderEditor;

  function clearStorage(): void {
    localStorage.removeItem(BORDER_STORAGE_KEY);
    localStorage.removeItem(LORE_STORAGE_KEY);
  }

  /** Dessine un triangle (positions en % de l'image, comme les clics sur la carte). */
  function drawTriangle(): void {
    editor.newKingdom();
    editor.onMapClick({ x: 10, y: 10 });
    editor.onMapClick({ x: 30, y: 10 });
    editor.onMapClick({ x: 20, y: 30 });
  }

  beforeEach(() => {
    clearStorage();
    TestBed.configureTestingModule({
      providers: [
        BorderEditor,
        { provide: MapBorderRepository, useClass: LocalStorageMapBorderRepository },
        { provide: LoreRepository, useClass: LocalStorageLoreRepository },
        { provide: WorldMapRepository, useClass: LocalStorageWorldMapRepository },
      ],
    });
    editor = TestBed.inject(BorderEditor);
  });

  afterEach(clearStorage);

  it('dessine un polygone : sommets normalisés, annulation du dernier point, fermeture sur le premier sommet', () => {
    drawTriangle();
    expect(editor.tool()).toBe('drawing');
    editor.onMapClick({ x: 50, y: 50 });
    editor.undoPoint();
    expect(editor.draft()!.points).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.1 },
      { x: 0.2, y: 0.3 },
    ]);
    expect(editor.sketch()?.closed).toBeFalse();

    editor.onVertexClick(0);
    expect(editor.draft()!.closed).toBeTrue();
    expect(editor.tool()).toBe('idle');
  });

  it('refuse de fermer un tracé de moins de trois sommets et d’enregistrer sans nom', async () => {
    editor.newKingdom();
    editor.onMapClick({ x: 10, y: 10 });
    editor.finish();
    expect(editor.feedback()?.kind).toBe('error');
    expect(editor.draft()!.closed).toBeFalse();

    editor.onMapClick({ x: 20, y: 10 });
    editor.onMapClick({ x: 20, y: 20 });
    editor.finish();
    await editor.save();
    expect(editor.feedback()?.message).toContain('Donnez un nom');
  });

  it('enregistre, modifie (sommets, déplacement) puis annule', async () => {
    drawTriangle();
    editor.finish();
    editor.patch({ name: 'Hautgivre', isPublic: true });
    await editor.save();
    const store = TestBed.inject(MapBorderStore);
    expect(store.borders().length).toBe(1);
    expect(store.publicBorders().length).toBe(1);

    editor.startEditing();
    editor.insertVertex({ index: 1, point: { x: 0.2, y: 0.05 } });
    editor.moveVertex({ index: 0, point: { x: 0.12, y: 0.12 } });
    editor.translate({ dx: 0.5, dy: 0 });
    expect(editor.draft()!.points.length).toBe(4);
    expect(Math.max(...editor.draft()!.points.map((p) => p.x))).toBeLessThanOrEqual(1);
    expect(editor.dirty()).toBeTrue();

    editor.cancel();
    expect(editor.draft()!.points.length).toBe(3);
    expect(editor.dirty()).toBeFalse();
  });

  it('crée une fiche « Royaume » pour la frontière', async () => {
    drawTriangle();
    editor.patch({ name: 'Royaume des Sables' });
    await editor.createKingdomEntry();
    const entry = TestBed.inject(LoreStore).findById(editor.draft()!.loreEntryId!);
    expect(entry?.type).toBe('Royaume');
    expect(entry?.status).toBe('Brouillon');
  });

  it('demande confirmation avant de supprimer', async () => {
    drawTriangle();
    editor.finish();
    editor.patch({ name: 'Éphémère' });
    await editor.save();
    const store = TestBed.inject(MapBorderStore);

    await editor.remove();
    expect(editor.confirmDelete()).toBeTrue();
    expect(store.borders().length).toBe(1);
    await editor.remove();
    expect(store.borders().length).toBe(0);
  });

  it('empêche de quitter une frontière modifiée sans enregistrer ni annuler', () => {
    drawTriangle();
    expect(editor.canLeaveDraft()).toBeFalse();
    editor.newKingdom();
    expect(editor.draft()!.points.length).toBe(3);
  });

  it('place le nom au centre de gravité du polygone', () => {
    expect(polygonCentroid([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])).toEqual({ x: 0.5, y: 0.5 });
  });
});
