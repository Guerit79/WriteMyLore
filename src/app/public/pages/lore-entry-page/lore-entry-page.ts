import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GrimoireBook } from '../../../shared/components/grimoire-book/grimoire-book';

/**
 * Page publique d'une fiche (`/lore/:id`) : le grimoire s'affiche déjà ouvert,
 * la fiche occupe la page de droite. Même mise en scène que la page d'accueil.
 */
@Component({
  selector: 'app-lore-entry-page',
  imports: [GrimoireBook, RouterLink],
  templateUrl: './lore-entry-page.html',
  styleUrl: '../home-page/home-page.css',
})
export class LoreEntryPage {
  /** Paramètre `:id` de la route, lié par le routeur (`withComponentInputBinding`). */
  readonly id = input.required<string>();
}
