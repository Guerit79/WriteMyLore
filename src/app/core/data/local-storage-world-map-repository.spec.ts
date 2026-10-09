import { firstValueFrom } from 'rxjs';
import { DEMO_MAP_PLACES } from '../map/world-map-demo-data';
import { MapPlace } from '../models/world-map';
import {
  LocalStorageWorldMapRepository,
  MAP_STORAGE_KEY,
  normalizePlace,
} from './local-storage-world-map-repository';

describe('LocalStorageWorldMapRepository', () => {
  const place = (id: string, loreEntryIds: string[] = []): MapPlace => ({
    id,
    name: `Lieu ${id}`,
    type: 'ville',
    position: { x: 10, y: 20 },
    description: '',
    zoneId: null,
    loreEntryIds,
  });

  beforeEach(() => localStorage.removeItem(MAP_STORAGE_KEY));
  afterEach(() => localStorage.removeItem(MAP_STORAGE_KEY));

  it('part des points de démonstration quand rien n’est enregistré', async () => {
    const places = await firstValueFrom(new LocalStorageWorldMapRepository().findAll());
    expect(places.map((item) => item.id)).toEqual(DEMO_MAP_PLACES.map((item) => item.id));
    expect(places.every((item) => item.demo)).toBeTrue();
  });

  it('enregistre les points et les relit après rechargement', async () => {
    await firstValueFrom(new LocalStorageWorldMapRepository().save(place('nouveau', ['fiche-1'])));

    const reloaded = await firstValueFrom(new LocalStorageWorldMapRepository().findAll());
    expect(reloaded.find((item) => item.id === 'nouveau')?.loreEntryIds).toEqual(['fiche-1']);
    expect(JSON.parse(localStorage.getItem(MAP_STORAGE_KEY)!).version).toBe(1);
  });

  it('permet à plusieurs fiches de partager un point, mais une fiche n’a qu’un point', async () => {
    const repository = new LocalStorageWorldMapRepository();
    await firstValueFrom(repository.save(place('a', ['fiche-1', 'fiche-2'])));
    const places = await firstValueFrom(repository.save(place('b', ['fiche-2'])));

    expect(places.find((item) => item.id === 'a')?.loreEntryIds).toEqual(['fiche-1']);
    expect(places.find((item) => item.id === 'b')?.loreEntryIds).toEqual(['fiche-2']);
  });

  it('supprime un point', async () => {
    const repository = new LocalStorageWorldMapRepository();
    await firstValueFrom(repository.save(place('a')));
    const places = await firstValueFrom(repository.delete('a'));
    expect(places.some((item) => item.id === 'a')).toBeFalse();
  });

  it('convertit l’ancien format (tableau, une seule fiche, type inconnu, sans zone)', async () => {
    localStorage.setItem(
      MAP_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'ancien',
          name: 'Ancien lieu',
          type: 'tour-de-mage',
          position: { x: 12.5, y: 140 },
          description: 'Décrit',
          loreEntryId: 'fiche-1',
        },
        { id: 'invalide', name: 'Sans position' },
      ]),
    );

    const places = await firstValueFrom(new LocalStorageWorldMapRepository().findAll());
    expect(places).toEqual([
      {
        id: 'ancien',
        name: 'Ancien lieu',
        type: 'autre',
        position: { x: 12.5, y: 100 },
        description: 'Décrit',
        zoneId: null,
        loreEntryIds: ['fiche-1'],
      },
    ]);
  });

  it('corrige une fiche présente sur deux points (le premier la garde)', async () => {
    localStorage.setItem(
      MAP_STORAGE_KEY,
      JSON.stringify({ version: 1, places: [place('a', ['fiche-1']), place('b', ['fiche-1', 'fiche-2'])] }),
    );
    const places = await firstValueFrom(new LocalStorageWorldMapRepository().findAll());
    expect(places.map((item) => item.loreEntryIds)).toEqual([['fiche-1'], ['fiche-2']]);
  });

  it('rejette un point sans nom ou sans position', () => {
    expect(normalizePlace({ ...place('a'), name: '  ' })).toBeNull();
    expect(normalizePlace({ ...place('a'), position: { x: 'dix', y: 2 } })).toBeNull();
  });
});
