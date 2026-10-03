import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoreLinkBuilder } from '../../../core/lore/lore-navigation';
import { LoreEntry } from '../../../core/models/lore';

/** Fil d'Ariane d'une fiche, construit avec `buildBreadcrumb` (relations hiérarchiques uniquement). */
@Component({
  selector: 'app-lore-breadcrumb',
  imports: [RouterLink],
  templateUrl: './lore-breadcrumb.html',
  styleUrl: './lore-breadcrumb.css',
})
export class LoreBreadcrumb {
  readonly trail = input.required<readonly LoreEntry[]>();
  readonly linkFor = input.required<LoreLinkBuilder>();
}
