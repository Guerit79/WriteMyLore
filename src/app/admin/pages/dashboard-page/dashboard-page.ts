import { Component, computed, inject, input } from '@angular/core';
import { LoreStore } from '../../../core/services/lore-store';
import { ADMIN_SECTIONS, toAdminSection } from '../../admin-sections';
import { LoreEntries } from '../../components/lore-entries/lore-entries';
import { LoreOverview } from '../../components/lore-overview/lore-overview';
import { LoreRelations } from '../../components/lore-relations/lore-relations';

@Component({
  selector: 'app-dashboard-page',
  imports: [LoreOverview, LoreEntries, LoreRelations],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  /** Paramètres de requête liés par le routeur (`withComponentInputBinding`). */
  readonly section = input<string>();
  readonly fiche = input<string>();

  protected readonly store = inject(LoreStore);
  protected readonly activeSection = computed(() => toAdminSection(this.section()));
  protected readonly sectionLabel = computed(
    () => ADMIN_SECTIONS.find((section) => section.id === this.activeSection())?.label ?? '',
  );
}
