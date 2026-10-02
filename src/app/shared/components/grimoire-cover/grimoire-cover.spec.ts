import { ComponentFixture, TestBed } from '@angular/core/testing';

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
});
