import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HOME_CHAPTER, chapterQueryParams } from '../../public-links';

/**
 * Cadre commun des pages de compte : reliure de cuir, page de parchemin encadrée,
 * titre et avertissement « mode démonstration ». Styles dans `src/account.css`.
 */
@Component({
  selector: 'app-account-sheet',
  imports: [RouterLink],
  templateUrl: './account-sheet.html',
})
export class AccountSheet {
  readonly heading = input.required<string>();

  protected readonly homeParams = chapterQueryParams(HOME_CHAPTER);
}
