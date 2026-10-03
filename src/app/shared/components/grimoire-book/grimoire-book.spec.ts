import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GrimoireBook } from './grimoire-book';
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
});
