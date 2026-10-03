import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { GrimoireCover } from './grimoire-cover';

describe('GrimoireCover', () => {
  let component: GrimoireCover;
  let fixture: ComponentFixture<GrimoireCover>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrimoireCover]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GrimoireCover);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  function cover(): HTMLElement {
    return fixture.nativeElement.querySelector('.grimoire-cover') as HTMLElement;
  }

  it('est utilisable au clavier (bouton focalisable et nommé)', () => {
    expect(cover().getAttribute('role')).toBe('button');
    expect(cover().tabIndex).toBe(0);
    expect(cover().getAttribute('aria-label')).toContain('Ouvrir le grimoire');
  });

  it('s’ouvre avec Entrée puis prévient la page après l’animation', fakeAsync(() => {
    let opened = 0;
    component.openBook.subscribe(() => opened++);
    cover().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(cover().classList).toContain('opening');
    tick(899);
    expect(opened).toBe(0);
    tick(1);
    expect(opened).toBe(1);
  }));

  it('s’ouvre avec Espace sans faire défiler la page, une seule fois', fakeAsync(() => {
    let opened = 0;
    component.openBook.subscribe(() => opened++);
    const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    cover().dispatchEvent(space);
    cover().click();
    tick(900);
    expect(space.defaultPrevented).toBeTrue();
    expect(opened).toBe(1);
  }));
});
