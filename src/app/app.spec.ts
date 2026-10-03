import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import {
  LORE_STORAGE_KEY,
  LocalStorageLoreRepository,
} from './core/data/local-storage-lore-repository';
import { LoreRepository } from './core/data/lore-repository';

describe('App', () => {
  beforeEach(async () => {
    localStorage.removeItem(LORE_STORAGE_KEY);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        { provide: LoreRepository, useClass: LocalStorageLoreRepository },
      ],
    }).compileComponents();
  });

  afterEach(() => localStorage.removeItem(LORE_STORAGE_KEY));

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  // L'ancien test cherchait le « Hello, WriteMyLore » du gabarit Angular CLI, absent de l'application.
  // Le titre réellement affiché à l'arrivée est celui de la couverture du grimoire.
  it('should render the grimoire cover title on the home page', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('h1.cover-title')?.textContent?.replace(/\s+/g, ' ').trim();
    expect(title).toBe('WRITE MY LORE');
    expect(compiled.querySelector('a.admin-access')?.getAttribute('href')).toBe('/admin');
  });
});
