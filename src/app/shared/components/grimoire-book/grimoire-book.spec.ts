import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GrimoireBook } from './grimoire-book';
import { LORE_STORAGE_KEY } from '../../../core/data/local-storage-lore-repository';
import { LocalStorageLoreRepository } from '../../../core/data/local-storage-lore-repository';
import { LoreRepository } from '../../../core/data/lore-repository';

describe('GrimoireBook', () => {
  let component: GrimoireBook;
  let fixture: ComponentFixture<GrimoireBook>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrimoireBook],
      providers: [
        provideRouter([]),
        { provide: LoreRepository, useClass: LocalStorageLoreRepository }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GrimoireBook);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  /** Même seuil que grimoire-book.mobile.css. */
  const SINGLE_PAGE_QUERY = '(max-width: 939.98px), (max-height: 649.98px)';

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => localStorage.removeItem(LORE_STORAGE_KEY));

  it('rend un seul contenu pour les deux mises en page (aucune duplication)', () => {
    expect(root().querySelectorAll('.book-tabs').length).toBe(1);
    expect(root().querySelectorAll('.book-spread').length).toBe(1);
    expect(root().querySelectorAll('.book-spread > .book-page').length).toBe(2);
    expect(root().querySelectorAll('.book-tab').length).toBe(6);
    expect(root().querySelectorAll('.chapter-list a').length).toBe(6);
  });

  it('applique la mise en page qui correspond à la taille de la fenêtre de test', () => {
    const book = root().querySelector('.grimoire-book') as HTMLElement;
    const expected = window.matchMedia(SINGLE_PAGE_QUERY).matches ? 'flex' : 'grid';
    expect(getComputedStyle(book).display).toBe(expected);
  });

  it('ouvre la page unique sur le Monde à l’accueil, sur le contenu ailleurs', () => {
    const spread = () => root().querySelector('.book-spread') as HTMLElement;
    expect(spread().classList).toContain('is-home');

    fixture.componentRef.setInput('chapter', 'factions');
    fixture.detectChanges();
    expect(spread().classList).not.toContain('is-home');

    fixture.componentRef.setInput('chapter', undefined);
    fixture.componentRef.setInput('entryId', 'demo-monde');
    fixture.detectChanges();
    expect(spread().classList).not.toContain('is-home');
  });
});
