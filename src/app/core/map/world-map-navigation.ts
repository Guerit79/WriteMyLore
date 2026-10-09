import { GeoNode, MapPlace, MapPlaceType } from '../models/world-map';

export type GeoNodeLookup = ReadonlyMap<string, GeoNode>;

export function indexGeoNodes(nodes: readonly GeoNode[]): GeoNodeLookup {
  return new Map(nodes.map((node) => [node.id, node]));
}

/** Chemin du continent jusqu'au nœud lui-même ; les parents introuvables et les cycles sont ignorés. */
export function buildGeoPath(nodeId: string | null, lookup: GeoNodeLookup): GeoNode[] {
  const path: GeoNode[] = [];
  const visited = new Set<string>();
  let node = nodeId ? lookup.get(nodeId) : undefined;

  while (node && !visited.has(node.id)) {
    path.unshift(node);
    visited.add(node.id);
    node = node.parentId ? lookup.get(node.parentId) : undefined;
  }

  return path;
}

/** Enfants directs d'un nœud (`null` : les continents). */
export function childNodes(parentId: string | null, nodes: readonly GeoNode[]): GeoNode[] {
  return nodes.filter((node) => (node.parentId ?? null) === parentId);
}

/** Vrai si le lieu se trouve dans le nœud (à n'importe quel niveau au-dessus de sa zone). */
export function isPlaceWithin(place: MapPlace, nodeId: string, lookup: GeoNodeLookup): boolean {
  return buildGeoPath(place.zoneId, lookup).some((node) => node.id === nodeId);
}

export interface MapPlaceFilter {
  /** Nœud de la hiérarchie sélectionné (`null` : tous les lieux). */
  nodeId: string | null;
  /** Types affichés (vide : tous les types). */
  types: ReadonlySet<MapPlaceType>;
}

export function filterPlaces(
  places: readonly MapPlace[],
  filter: MapPlaceFilter,
  lookup: GeoNodeLookup,
): MapPlace[] {
  return places.filter(
    (place) =>
      (filter.types.size === 0 || filter.types.has(place.type)) &&
      (!filter.nodeId || isPlaceWithin(place, filter.nodeId, lookup)),
  );
}
