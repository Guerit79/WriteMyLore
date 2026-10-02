import { Component } from '@angular/core';
import { GrimoireCover } from '../../../shared/components/grimoire-cover/grimoire-cover';
import { GrimoireBook } from '../../../shared/components/grimoire-book/grimoire-book';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [GrimoireCover, GrimoireBook],
  templateUrl: './home-page.html',
  styleUrls: ['./home-page.css']
})
export class HomePage {
  isBookOpen = false;

  openGrimoire(): void {
    this.isBookOpen = true;
  }
}