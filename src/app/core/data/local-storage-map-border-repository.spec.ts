import { firstValueFrom } from 'rxjs';
import { MapBorder, publicBorders } from '../models/map-border';
import {
  BORDER_STORAGE_KEY,
  LocalStorageMapBorderRepository,
  normalizeBorder,
} from './local-storage-map-border-repository';
import { MAP_STORAGE_KEY } from './local-storage-world-map-repository';

describe('LocalStorageMapBorderRepository', () => {
  const border = (id: string, change: Partial<MapBorder> = {}): MapBorder => ({
    id,
    name: `Royaume ${id}`,
    loreEntryId: null,
    color: '#8b1e1e',
    fillOpacity: 0.2,
    strokeStyle: 'plein',
    strokeWidth: 3,
    visible: true,
    isPublic: true,
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.1 },
      { x: 0.2, y: 0.3 },
    ],
    ...change,
  });

  beforeEach(() => localStorage.removeItem(BORDER_STORAGE_KEY));
  afterEach(() => localStorage.removeItem(BORDER_STORAGE_KEY));

  it('démarre sans frontière, carte publique activée', async () => {
    const repository = new LocalStorageMapBorderRepository();
    expect(await firstValueFrom(repository.findAll())).toEqual([]);
    expect(await firstValueFrom(repository.getSettings())).toEqual({ showOnPublicMap: true });
  });

  it('enregistre frontières et réglages, relus après rechargement, sans toucher aux lieux', async () => {
    const placesBefore = localStorage.getItem(MAP_STORAGE_KEY);
    const repository = new LocalStorageMapBorderRepository();
    await firstValueFrom(repository.save(border('a')));
    await firstValueFrom(repository.saveSettings({ showOnPublicMap: false }));

    const reloaded = new LocalStorageMapBorderRepository();
    expect((await firstValueFrom(reloaded.findAll()))[0]).toEqual(border('a'));
    expect(await firstValueFrom(reloaded.getSettings())).toEqual({ showOnPublicMap: false });
    expect(localStorage.getItem(MAP_STORAGE_KEY)).toBe(placesBefore);
  });

  it('remplace puis supprime une frontière', async () => {
    const repository = new LocalStorageMapBorderRepository();
    await firstValueFrom(repository.save(border('a')));
    const updated = await firstValueFrom(repository.save(border('a', { name: 'Nouveau nom' })));
    expect(updated.map((item) => item.name)).toEqual(['Nouveau nom']);
    expect(await firstValueFrom(repository.delete('a'))).toEqual([]);
  });

  it('relit avec tolérance les données incomplètes ou hors limites', () => {
    expect(
      normalizeBorder({
        id: 'x',
        name: ' Ancien ',
        color: 'rouge',
        fillOpacity: 4,
        strokeStyle: 'ondulé',
        strokeWidth: 50,
        points: [{ x: -1, y: 0.5 }, { x: 'a', y: 1 }, { x: 2, y: 2 }],
      }),
    ).toEqual({
      id: 'x',
      name: 'Ancien',
      loreEntryId: null,
      color: '#8b1e1e',
      fillOpacity: 0.6,
      strokeStyle: 'plein',
      strokeWidth: 8,
      visible: true,
      isPublic: false,
      points: [{ x: 0, y: 0.5 }, { x: 1, y: 1 }],
    });
    expect(normalizeBorder({ id: 'x', name: '  ' })).toBeNull();
  });

  it('ne montre au public que les frontières publiques, visibles et fermées', () => {
    const borders = [
      border('publique'),
      border('privee', { isPublic: false }),
      border('masquee', { visible: false }),
      border('ouverte', { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }),
    ];
    expect(publicBorders(borders, { showOnPublicMap: true }).map((item) => item.id)).toEqual(['publique']);
    expect(publicBorders(borders, { showOnPublicMap: false })).toEqual([]);
  });
});
