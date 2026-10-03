import { Component, DestroyRef, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { ADMIN_SECTIONS, toAdminSection } from '../../admin-sections';

/** Layout de l'administration : barre latérale + zone de contenu, distinct du grimoire public. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  protected readonly sections = ADMIN_SECTIONS;
  protected readonly activeSection = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => toAdminSection(params.get('section')))),
    { initialValue: toAdminSection(null) },
  );

  constructor() {
    // Viewport mobile limité à l'administration : le grimoire public garde son rendu actuel.
    const meta = inject(Meta);
    meta.updateTag({ name: 'viewport', content: 'width=device-width, initial-scale=1' });
    inject(DestroyRef).onDestroy(() => meta.removeTag("name='viewport'"));
  }
}
