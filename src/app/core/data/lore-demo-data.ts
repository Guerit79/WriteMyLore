import { LoreEntry, LoreEntryStatus, LoreEntryType, LoreRelationType } from '../models/lore';

const DEMO_DATE = '2026-01-01T00:00:00.000Z';

function demoEntry(
  id: string,
  name: string,
  type: LoreEntryType,
  status: LoreEntryStatus,
  summary: string,
  content: string,
  relations: readonly [LoreRelationType, string][] = [],
): LoreEntry {
  return {
    id,
    name,
    type,
    summary,
    content,
    status,
    relations: relations.map(([relationType, targetId], index) => ({
      id: `${id}--relation-${index + 1}`,
      sourceId: id,
      type: relationType,
      targetId,
    })),
    createdAt: DEMO_DATE,
    updatedAt: DEMO_DATE,
  };
}

/**
 * Fiches de démonstration.
 * Hiérarchie (fil d'Ariane) : Le Monde connu › Humains › Nordiens › Nordbriks › Ulrick le Grand.
 * Relations associées (hors fil d'Ariane) : Ulrick « dirige » les Nordbriks et « possède » Tranche-Horde.
 */
export function createDemoEntries(): LoreEntry[] {
  return [
    demoEntry(
      'demo-monde',
      'Le Monde connu',
      'Monde',
      'Publié',
      'Un monde ancien façonné par les peuples, les guerres de clans et les reliques oubliées. Ce grimoire en rassemble la mémoire.',
      'Des steppes glacées du Nord aux royaumes du Sud, le Monde connu porte les cicatrices des âges passés. Chaque peuple y garde ses chroniques, chaque clan ses serments et chaque arme ses légendes.\n\nCe grimoire réunit ces récits épars : les terres et les lieux, les peuples et leurs factions, les héros qui les ont menés et les objets qui ont changé le cours de l’histoire.',
    ),
    demoEntry(
      'demo-humains',
      'Humains',
      'Race',
      'Publié',
      'Le plus répandu des peuples du Monde connu, divisé en nombreuses nations rivales.',
      'Endurants et ambitieux, les Humains ont bâti des royaumes sur presque toutes les terres habitables. Leur histoire est faite d’alliances fragiles et de guerres de succession.',
      [['appartient à', 'demo-monde']],
    ),
    demoEntry(
      'demo-nordiens',
      'Nordiens',
      'Faction',
      'Publié',
      'Peuple guerrier des terres du Nord, uni par le serment des clans.',
      'Les Nordiens vivent au rythme des hivers rigoureux. Leurs clans se disputent les meilleures terres mais se rassemblent sous une même bannière face aux menaces extérieures.',
      [['appartient à', 'demo-humains']],
    ),
    demoEntry(
      'demo-nordbriks',
      'Nordbriks',
      'Clan',
      'Publié',
      'Le plus redouté des clans nordiens, réputé pour ses haches et sa loyauté.',
      'Installés au pied des montagnes, les Nordbriks forgent leurs armes dans le fer noir des mines ancestrales. Leur chef est choisi par l’épreuve du combat.',
      [['appartient à', 'demo-nordiens']],
    ),
    demoEntry(
      'demo-ulrick',
      'Ulrick le Grand',
      'Personnage',
      'Publié',
      'Chef légendaire des Nordbriks, porteur de la hache Tranche-Horde.',
      'Ulrick a uni les Nordbriks après trois hivers de guerre. Les scaldes chantent encore la bataille où il tint seul le gué face à une horde entière.',
      [
        ['appartient à', 'demo-nordbriks'],
        ['dirige', 'demo-nordbriks'],
        ['possède', 'demo-tranche-horde'],
      ],
    ),
    demoEntry(
      'demo-tranche-horde',
      'Tranche-Horde',
      'Objet',
      'Brouillon',
      'Hache de guerre forgée dans le fer noir, arme d’Ulrick le Grand.',
      'Selon la légende, sa lame ne s’émousse jamais tant que son porteur défend les siens.',
    ),
  ];
}
