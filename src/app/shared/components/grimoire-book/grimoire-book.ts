import { Component, ElementRef, computed, effect, inject, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ScrollParticlesDirective } from '../../directives/scroll-particles.directive';
import { LoreBreadcrumb } from '../lore-breadcrumb/lore-breadcrumb';
import { LoreRelationLinks } from '../lore-relation-links/lore-relation-links';
import { LORE_CATEGORIES } from '../../../core/models/lore';
import {
  buildBreadcrumb,
  findCategoryForType,
  getRelationLinks,
} from '../../../core/lore/lore-navigation';
import { LoreStore } from '../../../core/services/lore-store';
import { HOME_CHAPTER, chapterQueryParams, publicEntryLink } from '../../../public/public-links';

interface GrimoireTab {
  chapter: string;
  label: string;
  cssClass: string;
}

/** Onglets latéraux : chaque onglet ouvre un chapitre (une catégorie du Lore, l'accueil ou la magie). */
const GRIMOIRE_TABS: readonly GrimoireTab[] = [
  { chapter: HOME_CHAPTER, label: '⌂ Accueil', cssClass: '' },
  { chapter: 'peuples', label: '🌿 Races', cssClass: 'tab-races' },
  { chapter: 'magie', label: '✦ Magie', cssClass: 'tab-magie' },
  { chapter: 'factions', label: '⚔ Factions', cssClass: 'tab-factions' },
  { chapter: 'geographie', label: '🗺 Lieux', cssClass: 'tab-lieux' },
  { chapter: 'personnages', label: '★ Héros', cssClass: 'tab-heros' },
];

const KNOWN_CHAPTERS = new Set([
  ...GRIMOIRE_TABS.map((tab) => tab.chapter),
  ...LORE_CATEGORIES.map((category) => category.id),
]);

function toParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

@Component({
  selector: 'app-grimoire-book',
  standalone: true,
  imports: [ScrollParticlesDirective, RouterLink, LoreBreadcrumb, LoreRelationLinks],
  templateUrl: './grimoire-book.html',
  styleUrls: ['./grimoire-book.css', './grimoire-book.mobile.css'],
})


export class GrimoireBook {
  /** Chapitre demandé par l'URL (`?chapitre=`). */
  readonly chapter = input<string>();
  /** Fiche à afficher (`/lore/:id`) : prioritaire sur le chapitre. */
  readonly entryId = input<string>();

  private timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
  private hoveredElements = new Set<HTMLElement>();

  private readonly store = inject(LoreStore);
  private readonly rightPage = viewChild.required<ElementRef<HTMLElement>>('rightPage');

  protected readonly tabs = GRIMOIRE_TABS;
  protected readonly categories = LORE_CATEGORIES;
  protected readonly loaded = this.store.loaded;
  protected readonly linkFor = publicEntryLink;
  protected readonly chapterParams = chapterQueryParams;
  protected readonly homeParams = chapterQueryParams(HOME_CHAPTER);

  /** Fiche affichée : uniquement si elle existe ET est publiée. */
  protected readonly entry = computed(() => {
    const id = this.entryId();
    return id ? (this.store.findPublished(id) ?? null) : null;
  });
  protected readonly entryParagraphs = computed(() => toParagraphs(this.entry()?.content ?? ''));
  /** Fil d'Ariane et relations calculés sur les seules fiches publiées : aucun lien vers un brouillon. */
  protected readonly breadcrumb = computed(() => {
    const entry = this.entry();
    return entry ? buildBreadcrumb(entry, this.store.publishedLookup()) : [];
  });
  protected readonly relationLinks = computed(() => {
    const entry = this.entry();
    return entry
      ? getRelationLinks(entry, this.store.publishedEntries(), this.store.publishedLookup())
      : [];
  });

  /** Chapitre mis en avant : celui de la fiche affichée, sinon celui de l'URL (accueil par défaut). */
  protected readonly activeChapter = computed<string | null>(() => {
    if (this.entryId()) {
      const entry = this.entry();
      return entry ? (findCategoryForType(entry.type)?.id ?? HOME_CHAPTER) : null;
    }
    const chapter = this.chapter();
    return chapter && KNOWN_CHAPTERS.has(chapter) ? chapter : HOME_CHAPTER;
  });

  /** Page « Monde » : première fiche publiée de type Monde. */
  protected readonly world = computed(
    () => this.store.publishedEntries().find((entry) => entry.type === 'Monde') ?? null,
  );
  protected readonly worldParagraphs = computed(() => toParagraphs(this.world()?.content ?? ''));

  /** Accueil du grimoire : sur page unique, le Monde et ses chapitres passent avant les Archives. */
  protected readonly isHomeView = computed(
    () => !this.entryId() && this.activeChapter() === HOME_CHAPTER,
  );

  protected readonly activeCategory = computed(
    () => LORE_CATEGORIES.find((category) => category.id === this.activeChapter()) ?? null,
  );

  /** Fiches publiées du chapitre ouvert, rangées par type puis par nom. */
  protected readonly categoryEntries = computed(() => {
    const category = this.activeCategory();
    if (!category) {
      return [];
    }
    return this.store
      .publishedEntries()
      .filter((entry) => category.types.includes(entry.type))
      .sort(
        (a, b) =>
          category.types.indexOf(a.type) - category.types.indexOf(b.type) ||
          a.name.localeCompare(b.name, 'fr'),
      );
  });

  constructor() {
    // Nouveau chapitre ou nouvelle fiche : la page de droite repart du haut.
    effect(() => {
      this.activeChapter();
      this.entryId();
      this.rightPage().nativeElement.scrollTop = 0;
    });
  }

  onScroll(el: HTMLElement) {
    this.activateGlow(el);
  }

  onMouseMove(event: MouseEvent, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const isRtl = getComputedStyle(el).direction === 'rtl';
    const scrollbarZone = 16;

    const isNearScrollbar = isRtl
      ? event.clientX - rect.left < scrollbarZone
      : rect.right - event.clientX < scrollbarZone;

    if (isNearScrollbar) {
      this.hoveredElements.add(el);
      this.activateGlow(el);
    } else {
      this.hoveredElements.delete(el);
      this.scheduleDeactivate(el);
    }
  }

  onMouseLeave(el: HTMLElement) {
    this.hoveredElements.delete(el);
    this.scheduleDeactivate(el);
  }

  private activateGlow(el: HTMLElement) {
    el.classList.add('scrolling-active');
    const existingTimer = this.timers.get(el);
    if (existingTimer) clearTimeout(existingTimer);

    if (!this.hoveredElements.has(el)) {
      this.scheduleDeactivate(el);
    }
  }

  private scheduleDeactivate(el: HTMLElement) {
    const existingTimer = this.timers.get(el);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      if (!this.hoveredElements.has(el)) {
        el.classList.remove('scrolling-active');
      }
      this.timers.delete(el);
    }, 450);

    this.timers.set(el, timer);
  }
}
