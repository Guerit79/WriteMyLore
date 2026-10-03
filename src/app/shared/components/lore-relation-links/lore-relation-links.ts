import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoreLinkBuilder, LoreRelationLink } from '../../../core/lore/lore-navigation';
import { LoreRelation } from '../../../core/models/lore';

interface LoreRelationGroup {
  label: string;
  links: readonly LoreRelationLink[];
}

/**
 * Relations d'une fiche affichées comme liens cliquables (voir `getRelationLinks`),
 * séparées entre hiérarchie et relations associées.
 */
@Component({
  selector: 'app-lore-relation-links',
  imports: [RouterLink],
  templateUrl: './lore-relation-links.html',
  styleUrl: './lore-relation-links.css',
})
export class LoreRelationLinks {
  readonly links = input.required<readonly LoreRelationLink[]>();
  readonly linkFor = input.required<LoreLinkBuilder>();
  /** Affiche un bouton de suppression sur les relations sortantes. */
  readonly removable = input(false);
  readonly remove = output<LoreRelation>();

  protected readonly groups = computed<LoreRelationGroup[]>(() => {
    const links = this.links();
    return [
      { label: 'Hiérarchie', links: links.filter((link) => link.hierarchical) },
      { label: 'Relations associées', links: links.filter((link) => !link.hierarchical) },
    ].filter((group) => group.links.length > 0);
  });
}
