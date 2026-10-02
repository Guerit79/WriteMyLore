import { Component, ElementRef, ViewChild, HostListener} from '@angular/core';
import { ScrollParticlesDirective } from '../../directives/scroll-particles.directive';

@Component({
  selector: 'app-grimoire-book',
  standalone: true,
  imports: [ScrollParticlesDirective],
  templateUrl: './grimoire-book.html',
  styleUrl: './grimoire-book.css',
})


export class GrimoireBook {
  private timers = new Map<HTMLElement, any>();
  private hoveredElements = new Set<HTMLElement>();

  onScroll(el: HTMLElement) {
    this.activateGlow(el);
  }

  onMouseMove(event: MouseEvent, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const isRtl = getComputedStyle(el).direction === 'rtl';
    const scrollbarZone = 16;

    const isNearScrollbar = isRtl
      ? event.clientX - rect.left < scrollbarZone
      : rect.right - event.clientX < scrollbarZone;

    if (isNearScrollbar) {
      this.hoveredElements.add(el);
      this.activateGlow(el);
    } else {
      this.hoveredElements.delete(el);
      this.scheduleDeactivate(el);
    }
  }

  onMouseLeave(el: HTMLElement) {
    this.hoveredElements.delete(el);
    this.scheduleDeactivate(el);
  }

  private activateGlow(el: HTMLElement) {
    el.classList.add('scrolling-active');
    const existingTimer = this.timers.get(el);
    if (existingTimer) clearTimeout(existingTimer);

    if (!this.hoveredElements.has(el)) {
      this.scheduleDeactivate(el);
    }
  }

  private scheduleDeactivate(el: HTMLElement) {
    const existingTimer = this.timers.get(el);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      if (!this.hoveredElements.has(el)) {
        el.classList.remove('scrolling-active');
      }
      this.timers.delete(el);
    }, 450);

    this.timers.set(el, timer);
  }
}
