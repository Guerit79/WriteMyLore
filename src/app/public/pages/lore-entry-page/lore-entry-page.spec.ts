import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import {
  LORE_STORAGE_KEY,
  LocalStorageLoreRepository,
} from '../../../core/data/local-storage-lore-repository';
import { LoreRepository } from '../../../core/data/lore-repository';
import { AccountRepository } from '../../../core/data/account-repository';
import { DemoAccountRepository } from '../../../core/data/demo-account-repository';
import { LoreStore } from '../../../core/services/lore-store';

describe('Lecture publique du Lore', () => {
  let harness: RouterTestingHarness;

  /** Navigue comme le ferait une URL directe et renvoie le DOM rendu. */
  async function open(url: string): Promise<HTMLElement> {
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  /** Bouton Retour du navigateur (historique simulé), puis attente de la navigation qu'il déclenche. */
  async function back(): Promise<HTMLElement> {
    TestBed.inject(Location).back();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  function hrefs(root: HTMLElement): string[] {
    return Array.from(root.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
  }

  beforeEach(async () => {
    localStorage.removeItem(LORE_STORAGE_KEY);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        provideLocationMocks(),
        { provide: LoreRepository, useClass: LocalStorageLoreRepository },
        { provide: AccountRepository, useClass: DemoAccountRepository },
      ],
    });
    harness = await RouterTestingHarness.create();
    // Comme au démarrage réel de l'application : le routeur écoute l'historique (bouton Retour).
    TestBed.inject(Router).initialNavigation();
  });

  afterEach(() => localStorage.removeItem(LORE_STORAGE_KEY));

  it('affiche une fiche publiée avec son contenu et son titre de page', async () => {
    const page = await open('/lore/demo-ulrick');
    expect(page.querySelector('#lore-entry-title')?.textContent).toContain('Ulrick le Grand');
    expect(page.textContent).toContain('trois hivers de guerre');
    expect(TestBed.inject(Title).getTitle()).toBe('Ulrick le Grand · WriteMyLore');
  });

  it('n’affiche pas une fiche non publiée', async () => {
    const page = await open('/lore/demo-tranche-horde');
    expect(page.textContent).toContain('Fiche introuvable');
    expect(page.textContent).not.toContain('ne s’émousse jamais');
    expect(page.querySelector('#lore-entry-title')).toBeNull();
  });

  it('gère un identifiant inconnu avec un lien de retour à l’accueil', async () => {
    const page = await open('/lore/fiche-inexistante');
    expect(page.textContent).toContain('Fiche introuvable');
    expect(hrefs(page)).toContain('/?chapitre=accueil');
  });

  it('affiche des liens valides vers les fiches reliées publiées, jamais vers un brouillon', async () => {
    const page = await open('/lore/demo-ulrick');
    const links = hrefs(page.querySelector('app-lore-relation-links') as HTMLElement);
    expect(links).toContain('/lore/demo-nordbriks');
    // « Ulrick possède Tranche-Horde » existe, mais Tranche-Horde est un brouillon.
    expect(links).not.toContain('/lore/demo-tranche-horde');
    expect(page.textContent).not.toContain('Tranche-Horde (');
  });

  it('distingue hiérarchie et relations associées', async () => {
    const page = await open('/lore/demo-ulrick');
    const headings = Array.from(page.querySelectorAll('.lore-relations-heading')).map((h) =>
      h.textContent?.trim(),
    );
    expect(headings).toEqual(['Hiérarchie', 'Relations associées']);
  });

  it('construit le fil d’Ariane cliquable, sauf pour la fiche courante', async () => {
    const page = await open('/lore/demo-ulrick');
    const breadcrumb = page.querySelector('app-lore-breadcrumb') as HTMLElement;
    const items = Array.from(breadcrumb.querySelectorAll('li')).map((li) => li.textContent?.trim());
    expect(items).toEqual(['Le Monde connu', 'Humains', 'Nordiens', 'Nordbriks', 'Ulrick le Grand']);
    expect(hrefs(breadcrumb)).toEqual([
      '/lore/demo-monde',
      '/lore/demo-humains',
      '/lore/demo-nordiens',
      '/lore/demo-nordbriks',
    ]);
    expect(breadcrumb.querySelector('[aria-current="page"]')?.textContent).toContain('Ulrick');
  });

  it('affiche une fiche sans relation sans planter, sans fil d’Ariane', async () => {
    const created = await TestBed.inject(LoreStore).create({
      name: 'Port-Givre',
      type: 'Lieu',
      summary: 'Un port pris par les glaces.',
      content: 'Premier paragraphe.',
      status: 'Publié',
    });
    const page = await open(`/lore/${created.id}`);
    expect(page.querySelector('#lore-entry-title')?.textContent).toContain('Port-Givre');
    expect(page.textContent).toContain('Aucune relation pour le moment.');
    expect(page.querySelector('app-lore-breadcrumb')).toBeNull();
  });

  it('affiche le contenu comme du texte, sans interpréter le HTML', async () => {
    const created = await TestBed.inject(LoreStore).create({
      name: 'Piège',
      type: 'Objet',
      summary: '',
      content: '<img src="x" id="injected"> <b>gras</b>',
      status: 'Publié',
    });
    const page = await open(`/lore/${created.id}`);
    expect(page.querySelector('#injected')).toBeNull();
    expect(page.querySelector('.lore-entry-text')?.textContent).toContain('<b>gras</b>');
  });

  it('liste les fiches publiées d’un chapitre avec un lien vers leur page', async () => {
    const page = await open('/?chapitre=factions');
    const links = hrefs(page.querySelector('.right-page-content') as HTMLElement);
    expect(links).toEqual(['/lore/demo-nordiens', '/lore/demo-nordbriks']);
  });

  it('ne liste pas les brouillons dans les chapitres', async () => {
    const page = await open('/?chapitre=objets');
    expect(page.textContent).toContain('Aucune fiche publiée dans ce chapitre');
  });

  it('ouvre le grimoire depuis la couverture et le referme avec Retour', async () => {
    const router = TestBed.inject(Router);
    let page = await open('/');
    (page.querySelector('.grimoire-cover') as HTMLElement).click();
    harness.detectChanges();
    expect(page.querySelector('.grimoire-cover.opening')).not.toBeNull();

    // L'ouverture attend la fin de l'animation (900 ms) avant de naviguer.
    await new Promise((resolve) => setTimeout(resolve, 950));
    await harness.fixture.whenStable();
    harness.detectChanges();
    page = harness.routeNativeElement as HTMLElement;
    expect(router.url).toBe('/?chapitre=accueil');
    expect(page.querySelector('app-grimoire-book')).not.toBeNull();

    page = await back();
    expect(router.url).toBe('/');
    expect(page.querySelector('.grimoire-cover')).not.toBeNull();
  });

  it('suit les chapitres et revient au précédent avec Retour', async () => {
    const router = TestBed.inject(Router);
    await open('/?chapitre=peuples');
    let page = await open('/?chapitre=factions');
    expect(page.querySelector('.right-page-content h2')?.textContent).toContain('Factions');
    expect(page.querySelector('.book-tab.active')?.textContent).toContain('Factions');

    page = await back();
    expect(router.url).toBe('/?chapitre=peuples');
    expect(page.querySelector('.right-page-content h2')?.textContent).toContain('Peuples et races');
  });

  it('ouvre l’accueil du grimoire pour un chapitre inconnu', async () => {
    const page = await open('/?chapitre=nexiste-pas');
    expect(page.querySelector('.right-page-content h2')?.textContent).toContain('Archives');
    expect(page.querySelector('.book-tab.active')?.textContent).toContain('Accueil');
  });

  it('reste utilisable quand le Lore est vide', async () => {
    const store = TestBed.inject(LoreStore);
    for (const entry of [...store.entries()]) {
      await store.remove(entry.id);
    }
    let page = await open('/?chapitre=accueil');
    expect(page.textContent).toContain('Le monde attend encore d’être écrit');
    page = await open('/?chapitre=personnages');
    expect(page.textContent).toContain('Aucune fiche publiée dans ce chapitre');
    page = await open('/lore/demo-ulrick');
    expect(page.textContent).toContain('Fiche introuvable');
  });
});
