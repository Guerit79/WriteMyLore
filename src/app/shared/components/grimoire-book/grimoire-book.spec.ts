import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GrimoireBook } from './grimoire-book';

describe('GrimoireBook', () => {
  let component: GrimoireBook;
  let fixture: ComponentFixture<GrimoireBook>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrimoireBook]
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
