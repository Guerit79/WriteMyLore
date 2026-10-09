import { Component, inject } from '@angular/core';
import {
  BORDER_FILL_OPACITY,
  BORDER_MIN_POINTS,
  BORDER_STROKE_STYLES,
  BORDER_STROKE_WIDTH,
} from '../../../core/models/map-border';
import { LoreStore } from '../../../core/services/lore-store';
import { RouterLink } from '@angular/router';
import { adminEntryLink } from '../../admin-sections';
import { BorderEditor } from './border-editor';

/**
 * Panneau « Frontières » de l'éditeur de carte (page de gauche) : réglages des calques,
 * liste des royaumes, outils de tracé et réglages de la frontière ouverte.
 */
@Component({
  selector: 'app-border-panel',
  imports: [RouterLink],
  templateUrl: './border-panel.html',
})
export class BorderPanel {
  protected readonly editor = inject(BorderEditor);
  private readonly loreStore = inject(LoreStore);

  protected readonly strokeStyles = BORDER_STROKE_STYLES;
  protected readonly strokeWidth = BORDER_STROKE_WIDTH;
  protected readonly fillOpacity = BORDER_FILL_OPACITY;
  protected readonly minPoints = BORDER_MIN_POINTS;
  protected readonly entryLink = adminEntryLink;

  protected entryFor(id: string | null) {
    return id ? (this.loreStore.findById(id) ?? null) : null;
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected percent(opacity: number): number {
    return Math.round(opacity * 100);
  }
}
