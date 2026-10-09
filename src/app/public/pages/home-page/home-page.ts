import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GrimoireCover } from '../../../shared/components/grimoire-cover/grimoire-cover';
import { GrimoireBook } from '../../../shared/components/grimoire-book/grimoire-book';
import { AccountMenu } from '../../components/account-menu/account-menu';
import { HOME_CHAPTER, chapterQueryParams } from '../../public-links';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [GrimoireCover, GrimoireBook, RouterLink, AccountMenu],
  templateUrl: './home-page.html',
  styleUrls: ['./home-page.css']
})
export class HomePage {
  /** Paramètre `?chapitre=` lié par le routeur : présent = grimoire ouvert sur ce chapitre. */
  readonly chapitre = input<string>();

  private readonly router = inject(Router);

  protected readonly isBookOpen = computed(() => !!this.chapitre());

  /** Après l'animation d'ouverture : l'URL porte l'état ouvert (le bouton Retour referme le livre). */
  openGrimoire(): void {
    void this.router.navigate(['/'], { queryParams: chapterQueryParams(HOME_CHAPTER) });
  }
}
