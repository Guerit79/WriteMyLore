import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-grimoire-cover',
  standalone: true,
  imports: [],
  templateUrl: './grimoire-cover.html',
  styleUrl: './grimoire-cover.css'
})

export class GrimoireCover {
  @Output() openBook = new EventEmitter<void>();

  isOpening = false;

  open(): void {
    if (this.isOpening) {
      return;
    }
    this.isOpening = true;

    setTimeout(() => {
      this.openBook.emit();
    }, 900);
  }
}