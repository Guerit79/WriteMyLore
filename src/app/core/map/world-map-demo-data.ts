import { GeoNode, MapPlace } from '../models/world-map';

/*
 * ⚠ DONNÉES DE DÉMONSTRATION ⚠
 * Ces lieux et cette hiérarchie sont fictifs : ils servent à montrer la carte interactive.
 * Ils ne proviennent d'aucun serveur ni d'aucune base de données.
 * Les lieux ci-dessous sont les points initiaux : au premier chargement, ils sont recopiés dans
 * le stockage du navigateur, puis modifiables depuis l'éditeur de carte (/admin/carte).
 * La hiérarchie (DEMO_GEO_NODES) n'est pas encore modifiable depuis l'interface.
 * `position` est exprimée en pourcentage de l'image (x de gauche à droite, y de haut en bas).
 */

export const DEMO_GEO_NODES: readonly GeoNode[] = [
  // Continent oriental
  { id: 'demo-aldoran', name: 'Aldoran', level: 'Continent' },

  { id: 'demo-hautgivre', name: 'Royaume de Hautgivre', level: 'Royaume', parentId: 'demo-aldoran' },
  { id: 'demo-vallees-nord', name: 'Vallées du Nord', level: 'Région', parentId: 'demo-hautgivre' },
  { id: 'demo-coeur-vallees', name: 'Cœur des vallées', level: 'Zone', parentId: 'demo-vallees-nord' },
  { id: 'demo-cimes-blanches', name: 'Cimes blanches', level: 'Région', parentId: 'demo-hautgivre' },
  { id: 'demo-col-nordbrik', name: 'Col des Nordbriks', level: 'Zone', parentId: 'demo-cimes-blanches' },

  { id: 'demo-sables', name: 'Royaume des Sables', level: 'Royaume', parentId: 'demo-aldoran' },
  { id: 'demo-cote-palmes', name: 'Côte des Palmes', level: 'Région', parentId: 'demo-sables' },
  { id: 'demo-rivage-ouest', name: 'Rivage d’Occident', level: 'Zone', parentId: 'demo-cote-palmes' },
  { id: 'demo-desert-ocre', name: 'Désert d’Ocre', level: 'Région', parentId: 'demo-sables' },
  { id: 'demo-gue-caravanes', name: 'Gué des caravanes', level: 'Zone', parentId: 'demo-desert-ocre' },
  { id: 'demo-coeur-desert', name: 'Cœur du désert', level: 'Zone', parentId: 'demo-desert-ocre' },

  { id: 'demo-marches', name: 'Marches sylvestres', level: 'Royaume', parentId: 'demo-aldoran' },
  { id: 'demo-forets-est', name: 'Forêts de l’Est', level: 'Région', parentId: 'demo-marches' },
  { id: 'demo-lisiere', name: 'Lisière orientale', level: 'Zone', parentId: 'demo-forets-est' },
  { id: 'demo-monts-sud', name: 'Monts du Sud', level: 'Région', parentId: 'demo-marches' },
  { id: 'demo-cirque', name: 'Cirque des pics', level: 'Zone', parentId: 'demo-monts-sud' },

  // Îles de l'ouest
  { id: 'demo-occident', name: 'Îles d’Occident', level: 'Continent' },

  { id: 'demo-principaute', name: 'Principauté d’Ocre', level: 'Royaume', parentId: 'demo-occident' },
  { id: 'demo-ile-rouge', name: 'Île Rouge', level: 'Région', parentId: 'demo-principaute' },
  { id: 'demo-cote-cendres', name: 'Côte des cendres', level: 'Zone', parentId: 'demo-ile-rouge' },

  { id: 'demo-jarlat', name: 'Jarlat des Glaces', level: 'Royaume', parentId: 'demo-occident' },
  { id: 'demo-ile-blanche', name: 'Île Blanche', level: 'Région', parentId: 'demo-jarlat' },
  { id: 'demo-plateau-gele', name: 'Plateau gelé', level: 'Zone', parentId: 'demo-ile-blanche' },
];

export const DEMO_MAP_PLACES: readonly MapPlace[] = [
  {
    id: 'demo-lieu-hautgivre',
    name: 'Hautgivre',
    type: 'capitale',
    position: { x: 65.9, y: 29.2 },
    description: 'Cité royale aux tours sombres, gardienne des routes qui descendent des montagnes.',
    zoneId: 'demo-coeur-vallees',
    loreEntryIds: [],
    demo: true,
  },
  {
    id: 'demo-lieu-bastion-nordbrik',
    name: 'Bastion des Nordbriks',
    type: 'fort',
    position: { x: 52.2, y: 18.4 },
    description: 'Forteresse adossée aux cimes enneigées, où le clan forge ses haches de fer noir.',
    zoneId: 'demo-col-nordbrik',
    // Fiche de démonstration du Lore (« Nordbriks ») : le lien apparaît si elle est publiée.
    loreEntryIds: ['demo-nordbriks'],
    demo: true,
  },
  {
    id: 'demo-lieu-port-palmier',
    name: 'Port-Palmier',
    type: 'ville',
    position: { x: 50.3, y: 54.6 },
    description: 'Comptoir marchand bordé de palmiers, première escale des navires venus de l’ouest.',
    zoneId: 'demo-rivage-ouest',
    loreEntryIds: [],
    demo: true,
  },
  {
    id: 'demo-lieu-tour-du-gue',
    name: 'Tour du Gué',
    type: 'fort',
    position: { x: 63.75, y: 55.5 },
    description: 'Tour de guet qui surveille le passage des caravanes à l’embouchure du fleuve.',
    zoneId: 'demo-gue-caravanes',
    loreEntryIds: [],
    demo: true,
  },
  {
    id: 'demo-lieu-puits-ocre',
    name: 'Puits-d’Ocre',
    type: 'ville',
    position: { x: 62.2, y: 66.6 },
    description: 'Bourgade bâtie autour du seul puits d’eau douce du désert.',
    zoneId: 'demo-coeur-desert',
    loreEntryIds: [],
    demo: true,
  },
  {
    id: 'demo-lieu-sylve-ambre',
    name: 'Sylve d’Ambre',
    type: 'foret',
    position: { x: 83.75, y: 69.2 },
    description: 'Forêt profonde aux feuillages dorés, que les voyageurs disent habitée.',
    zoneId: 'demo-lisiere',
    loreEntryIds: [],
    demo: true,
  },
  {
    id: 'demo-lieu-temple-englouti',
    name: 'Temple englouti',
    type: 'ruine',
    position: { x: 69.25, y: 87.4 },
    description: 'Ruines d’un sanctuaire oublié, à demi noyées au fond d’un cirque de pics.',
    zoneId: 'demo-cirque',
    loreEntryIds: [],
    demo: true,
  },
  {
    id: 'demo-lieu-grotte-braises',
    name: 'Grotte des Braises',
    type: 'grotte',
    position: { x: 27, y: 56.9 },
    description: 'Caverne tiède de l’île Rouge ; on y entend gronder la roche.',
    zoneId: 'demo-cote-cendres',
    loreEntryIds: [],
    demo: true,
  },
  {
    id: 'demo-lieu-grotte-givre',
    name: 'Grotte du Givre',
    type: 'grotte',
    position: { x: 31.25, y: 4.7 },
    description: 'Antre glacé du nord, refuge des chasseurs du Jarlat pendant les tempêtes.',
    zoneId: 'demo-plateau-gele',
    loreEntryIds: [],
    demo: true,
  },
];
