import { createDemoEntries } from '../data/lore-demo-data';
import { LoreEntry } from '../models/lore';
import {
  buildBreadcrumb,
  getRelationLinks,
  indexEntries,
  isHierarchicalRelation,
} from './lore-navigation';

describe('lore-navigation', () => {
  const entries = createDemoEntries();
  const lookup = indexEntries(entries);
  const ulrick = lookup.get('demo-ulrick') as LoreEntry;

  it('ne considère hiérarchiques que les règles prévues', () => {
    expect(isHierarchicalRelation('Lieu', 'se trouve dans')).toBeTrue();
    expect(isHierarchicalRelation('Clan', 'appartient à')).toBeTrue();
    expect(isHierarchicalRelation('Objet', 'appartient à')).toBeFalse();
    expect(isHierarchicalRelation('Personnage', 'possède')).toBeFalse();
    expect(isHierarchicalRelation('Personnage', 'se trouve dans')).toBeFalse();
  });

  it('construit le fil d’Ariane à partir des seules relations hiérarchiques', () => {
    expect(buildBreadcrumb(ulrick, lookup).map((entry) => entry.name)).toEqual([
      'Le Monde connu',
      'Humains',
      'Nordiens',
      'Nordbriks',
      'Ulrick le Grand',
    ]);
  });

  it('garde « possède » et « dirige » comme relations associées', () => {
    const associated = getRelationLinks(ulrick, entries, lookup)
      .filter((link) => !link.hierarchical)
      .map((link) => `${link.relation.type} ${link.other.name}`);
    expect(associated).toEqual(['dirige Nordbriks', 'possède Tranche-Horde']);
  });

  it('liste aussi les relations entrantes', () => {
    const sword = lookup.get('demo-tranche-horde') as LoreEntry;
    const links = getRelationLinks(sword, entries, lookup);
    expect(links.length).toBe(1);
    expect(links[0].direction).toBe('incoming');
    expect(links[0].other.name).toBe('Ulrick le Grand');
  });

  it('résiste aux cycles hiérarchiques', () => {
    const a: LoreEntry = { ...ulrick, id: 'a', type: 'Lieu', relations: [] };
    const b: LoreEntry = { ...ulrick, id: 'b', type: 'Lieu', relations: [] };
    a.relations = [{ id: 'r1', sourceId: 'a', type: 'se trouve dans', targetId: 'b' }];
    b.relations = [{ id: 'r2', sourceId: 'b', type: 'se trouve dans', targetId: 'a' }];
    expect(buildBreadcrumb(a, indexEntries([a, b])).map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('résiste à une fiche qui se référence elle-même', () => {
    const loop: LoreEntry = { ...ulrick, id: 'loop', type: 'Région', relations: [] };
    loop.relations = [{ id: 'r', sourceId: 'loop', type: 'se trouve dans', targetId: 'loop' }];
    expect(buildBreadcrumb(loop, indexEntries([loop])).map((entry) => entry.id)).toEqual(['loop']);
  });

  it('réduit le fil d’Ariane à la fiche elle-même quand elle n’a pas de parent', () => {
    const monde = lookup.get('demo-monde') as LoreEntry;
    const sword = lookup.get('demo-tranche-horde') as LoreEntry;
    expect(buildBreadcrumb(monde, lookup)).toEqual([monde]);
    // « Tranche-Horde » n'a qu'une relation entrante « possède » : pas de parent.
    expect(buildBreadcrumb(sword, lookup)).toEqual([sword]);
  });

  it('ignore les relations non hiérarchiques et les parents introuvables', () => {
    const lieu: LoreEntry = {
      ...ulrick,
      id: 'lieu',
      type: 'Lieu',
      relations: [
        { id: 'r1', sourceId: 'lieu', type: 'se trouve dans', targetId: 'fantome' },
        { id: 'r2', sourceId: 'lieu', type: 'est lié à', targetId: 'demo-monde' },
        { id: 'r3', sourceId: 'lieu', type: 'se trouve dans', targetId: 'demo-humains' },
      ],
    };
    const trail = buildBreadcrumb(lieu, indexEntries([...entries, lieu]));
    // r1 pointe vers une fiche absente, r2 n'est pas hiérarchique : seul r3 est suivi.
    expect(trail.map((entry) => entry.id)).toEqual(['demo-monde', 'demo-humains', 'lieu']);
  });

  it('n’utilise pas « appartient à » comme hiérarchie pour un type non concerné', () => {
    const objet: LoreEntry = {
      ...ulrick,
      id: 'objet',
      type: 'Objet',
      relations: [{ id: 'r', sourceId: 'objet', type: 'appartient à', targetId: 'demo-ulrick' }],
    };
    expect(buildBreadcrumb(objet, indexEntries([...entries, objet]))).toEqual([objet]);
  });

  it('ignore les relations vers des fiches absentes dans les liens', () => {
    const orphan: LoreEntry = {
      ...ulrick,
      id: 'orphan',
      relations: [{ id: 'r', sourceId: 'orphan', type: 'possède', targetId: 'fantome' }],
    };
    expect(getRelationLinks(orphan, [orphan], indexEntries([orphan]))).toEqual([]);
  });
});
