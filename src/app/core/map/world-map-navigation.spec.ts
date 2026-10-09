import { GEO_LEVELS, GeoNode, MapPlace } from '../models/world-map';
import { DEMO_GEO_NODES, DEMO_MAP_PLACES } from './world-map-demo-data';
import { buildGeoPath, childNodes, filterPlaces, indexGeoNodes, isPlaceWithin } from './world-map-navigation';

describe('Navigation de la carte du monde', () => {
  const nodes: GeoNode[] = [
    { id: 'c', name: 'Continent', level: 'Continent' },
    { id: 'r', name: 'Royaume', level: 'Royaume', parentId: 'c' },
    { id: 'g', name: 'Région', level: 'Région', parentId: 'r' },
    { id: 'z1', name: 'Zone 1', level: 'Zone', parentId: 'g' },
    { id: 'z2', name: 'Zone 2', level: 'Zone', parentId: 'g' },
  ];
  const place = (id: string, type: MapPlace['type'], zoneId: string): MapPlace => ({
    id,
    name: id,
    type,
    position: { x: 50, y: 50 },
    description: '',
    zoneId,
    loreEntryIds: [],
  });
  const places = [place('a', 'ville', 'z1'), place('b', 'fort', 'z2'), place('c', 'ville', 'z2')];
  const lookup = indexGeoNodes(nodes);

  it('construit le chemin Continent → … → Zone', () => {
    expect(buildGeoPath('z1', lookup).map((node) => node.id)).toEqual(['c', 'r', 'g', 'z1']);
    expect(buildGeoPath(null, lookup)).toEqual([]);
    expect(buildGeoPath('inconnu', lookup)).toEqual([]);
  });

  it('ignore les cycles', () => {
    const cyclic = indexGeoNodes([
      { id: 'x', name: 'X', level: 'Région', parentId: 'y' },
      { id: 'y', name: 'Y', level: 'Royaume', parentId: 'x' },
    ]);
    expect(buildGeoPath('x', cyclic).map((node) => node.id)).toEqual(['y', 'x']);
  });

  it('liste les enfants directs', () => {
    expect(childNodes(null, nodes).map((node) => node.id)).toEqual(['c']);
    expect(childNodes('g', nodes).map((node) => node.id)).toEqual(['z1', 'z2']);
  });

  it('accepte un lieu sans zone (visible seulement dans « Tous les lieux »)', () => {
    const free = { ...place('libre', 'autre', 'z1'), zoneId: null };
    expect(buildGeoPath(free.zoneId, lookup)).toEqual([]);
    expect(filterPlaces([free], { nodeId: null, types: new Set() }, lookup).length).toBe(1);
    expect(filterPlaces([free], { nodeId: 'c', types: new Set() }, lookup).length).toBe(0);
  });

  it('filtre par nœud de la hiérarchie et par type', () => {
    expect(isPlaceWithin(places[0], 'c', lookup)).toBeTrue();
    expect(isPlaceWithin(places[0], 'z2', lookup)).toBeFalse();
    const ids = (nodeId: string | null, types: MapPlace['type'][]) =>
      filterPlaces(places, { nodeId, types: new Set(types) }, lookup).map((item) => item.id);
    expect(ids(null, [])).toEqual(['a', 'b', 'c']);
    expect(ids('z2', [])).toEqual(['b', 'c']);
    expect(ids(null, ['ville'])).toEqual(['a', 'c']);
    expect(ids('z2', ['ville'])).toEqual(['c']);
  });

  describe('données de démonstration', () => {
    const demoLookup = indexGeoNodes(DEMO_GEO_NODES);

    it('ont des identifiants uniques', () => {
      const ids = [...DEMO_GEO_NODES, ...DEMO_MAP_PLACES].map((item) => item.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('respectent la hiérarchie Continent → Royaume → Région → Zone', () => {
      for (const node of DEMO_GEO_NODES) {
        const path = buildGeoPath(node.id, demoLookup);
        expect(path.map((item) => item.level))
          .withContext(node.id)
          .toEqual(GEO_LEVELS.slice(0, GEO_LEVELS.indexOf(node.level) + 1));
      }
    });

    it('placent chaque lieu dans une zone, à l’intérieur de l’image', () => {
      for (const item of DEMO_MAP_PLACES) {
        expect(demoLookup.get(item.zoneId ?? '')?.level).withContext(item.id).toBe('Zone');
        for (const value of [item.position.x, item.position.y]) {
          expect(value).withContext(item.id).toBeGreaterThanOrEqual(0);
          expect(value).withContext(item.id).toBeLessThanOrEqual(100);
        }
      }
    });

    it('montrent plusieurs types de lieux', () => {
      const types = new Set(DEMO_MAP_PLACES.map((item) => item.type));
      expect(types).toEqual(new Set(['capitale', 'ville', 'fort', 'foret', 'ruine', 'grotte']));
    });
  });
});
