import { Directive, ElementRef, HostListener, inject } from '@angular/core';

@Directive({
  selector: '[appScrollParticles]',
  standalone: true
})
export class ScrollParticlesDirective {
  private el = inject(ElementRef);

  @HostListener('scroll')
  onScroll(): void {
    this.spawnParticle();
  }

  private spawnParticle(): void {
    const host = this.el.nativeElement as HTMLElement;
    const rect = host.getBoundingClientRect();

    const maxScroll = host.scrollHeight - host.clientHeight || 1;
    const scrollRatio = host.scrollTop / maxScroll;
    const thumbY = rect.top + scrollRatio * (rect.height - 40) + 20;

    // Détecte si la scrollbar est à gauche (direction: rtl) ou à droite (ltr)
    const isRtl = getComputedStyle(host).direction === 'rtl';
    const thumbX = isRtl ? rect.left + 6 : rect.right - 6;

    const particle = document.createElement('div');
    particle.className = 'scroll-magic-particle';

    particle.style.left = `${thumbX}px`;
    particle.style.top = `${thumbY}px`;

    const size = 3 + Math.random() * 4;
    const drift = (Math.random() - 0.5) * 40;
    const duration = 0.8 + Math.random() * 0.6;

    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.setProperty('--drift', `${drift}px`);
    particle.style.animationDuration = `${duration}s`;

    document.body.appendChild(particle);

    setTimeout(() => particle.remove(), duration * 1000);
  }
}