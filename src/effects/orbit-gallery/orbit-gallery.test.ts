import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTickerStats } from '../../core/ticker';
import { autoRadius, flingTarget, mod, OrbitGalleryElement, ringPlacement, wrapAngle } from './index';

describe('helpers', () => {
  it('wraps angles and indices', () => {
    expect(wrapAngle(0)).toBe(0);
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(Math.PI * 1.5)).toBeCloseTo(-Math.PI / 2);
    expect(mod(-1, 10)).toBe(9);
    expect(mod(23, 10)).toBe(3);
  });

  it('places cards on the ring: front is big and bright, the back is hidden', () => {
    const front = ringPlacement(0, 0, 8, 300);
    expect(front).toMatchObject({ angle: 0, x: 0, z: 0, depth: 0, opacity: 1, front: 1 });
    const right = ringPlacement(1, 0, 8, 300);
    expect(right.x).toBeGreaterThan(0);
    expect(right.z).toBeLessThan(0);
    expect(right.rotate).toBeGreaterThan(0);
    expect(right.front).toBe(0);
    expect(ringPlacement(7, 0, 8, 300).x).toBeLessThan(0); // the previous card is on the left
    const back = ringPlacement(4, 0, 8, 300);
    expect(back.depth).toBeCloseTo(1);
    expect(back.opacity).toBe(0);
    expect(ringPlacement(0, 0.5, 8, 300).front).toBeCloseTo(0.25); // half a card away
    expect(ringPlacement(1, 0, 8, 300, 0).rotate).toBe(0); // facing 0: always face the viewer
  });

  it('predicts where a fling settles and sizes the ring', () => {
    expect(flingTarget(2.2, 0, 3, 10)).toBe(2);
    expect(flingTarget(2.2, 9, 3, 10)).toBe(5);
    expect(flingTarget(0, -300, 3, 10)).toBe(-10); // capped at one lap
    expect(autoRadius(200, 3)).toBeCloseTo(220); // never tighter than a card
    expect(autoRadius(200, 12)).toBeGreaterThan(500);
  });
});

describe('<ane-orbit-gallery>', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  const mount = (attrs = '', n = 6): OrbitGalleryElement => {
    const cards = Array.from({ length: n }, (_, i) => `<a href="#${i}" class="c"><h3>Card ${i}</h3></a>`).join('');
    document.body.innerHTML = `<ane-orbit-gallery ${attrs}>${cards}</ane-orbit-gallery>`;
    return document.querySelector('ane-orbit-gallery')!;
  };
  const settle = (): void => {
    vi.advanceTimersByTime(2500);
  };

  it('is an accessible carousel with labelled slides', () => {
    const el = mount();
    expect(el).toBeInstanceOf(OrbitGalleryElement);
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-roledescription')).toBe('carousel');
    expect(el.tabIndex).toBe(0);
    const first = el.querySelector('a')!;
    expect(first.getAttribute('aria-roledescription')).toBe('slide');
    expect(first.getAttribute('aria-label')).toBe('1 of 6');
    expect(el.cards).toHaveLength(6);
  });

  it('turns the short way round with next / prev / goTo and fires ane-orbit-change', () => {
    const el = mount();
    const seen: number[] = [];
    el.addEventListener('ane-orbit-change', (e) => seen.push(e.detail.index));
    el.next();
    settle();
    expect(el.index).toBe(1);
    expect(el.position).toBe(1);
    el.goTo(5); // 4 forward or 2 back: goes back
    settle();
    expect(el.index).toBe(5);
    expect(el.position).toBe(-1);
    el.prev();
    settle();
    expect(el.index).toBe(4);
    expect(seen.at(-1)).toBe(4);
    expect(el.querySelector('[data-current]')?.textContent).toBe('Card 4');
    expect(el.moving).toBe(false);
  });

  it('supports arrow keys, Home and End', () => {
    const el = mount();
    const key = (k: string): boolean => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    expect(key('ArrowRight')).toBe(false); // handled → default prevented
    settle();
    expect(el.index).toBe(1);
    key('End');
    settle();
    expect(el.index).toBe(5);
    key('Home');
    settle();
    expect(el.index).toBe(0);
    expect(key('a')).toBe(true);
    // The settled card is announced.
    expect(el.shadowRoot!.querySelector('[aria-live]')?.textContent).toBe('1 of 6: Card 0');
  });

  it('drags, flings with inertia and snaps onto a whole card', () => {
    const el = mount('card-width="200"');
    const px = (el.radius * Math.PI * 2) / 6;
    const p = (type: string, x: number): boolean =>
      el.dispatchEvent(new PointerEvent(type, { pointerId: 1, button: 0, clientX: x, clientY: 50, bubbles: true }));
    p('pointerdown', 400);
    for (let k = 1; k <= 5; k++) {
      vi.advanceTimersByTime(16);
      p('pointermove', 400 - k * px * 0.3);
    }
    expect(el.position).toBeCloseTo(1.5, 1);
    p('pointerup', 400 - 5 * px * 0.3);
    expect(el.moving).toBe(true);
    settle();
    expect(el.moving).toBe(false);
    expect(Number.isInteger(el.position)).toBe(true);
    expect(el.position).toBeGreaterThanOrEqual(2); // the fling carried it further than the drag
  });

  it('brings a pressed side card to the front and swallows its click', () => {
    const el = mount();
    const side = el.querySelectorAll('a')[2]!;
    side.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, button: 0, clientX: 10, bubbles: true, composed: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, button: 0, clientX: 10, bubbles: true }));
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    side.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    settle();
    expect(el.index).toBe(2);
    // The front card's own click goes through.
    const again = new MouseEvent('click', { bubbles: true, cancelable: true });
    side.dispatchEvent(again);
    expect(again.defaultPrevented).toBe(false);
  });

  it('turns to a card when focus moves into it', () => {
    const el = mount();
    el.querySelectorAll('a')[3]!.focus();
    settle();
    expect(el.index).toBe(3);
  });

  it('autoplays, and jumps without spinning under reduced motion', () => {
    const el = mount('autoplay="1000"');
    vi.advanceTimersByTime(1100);
    settle();
    expect(el.index).toBeGreaterThanOrEqual(1);

    const still = mount('motion="reduce" autoplay="500"');
    still.goTo(4);
    expect(still.position).toBe(-2); // immediately, the short way
    expect(still.moving).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(still.index).toBe(4); // no autoplay
  });

  it('places cards with 3D transforms and cleans up when removed', () => {
    const errors = vi.spyOn(console, 'error');
    const el = mount('tilt="0"');
    vi.advanceTimersByTime(50);
    const cards = el.querySelectorAll<HTMLElement>('a');
    expect(cards[0]!.style.transform).toContain('translate3d(0.00px, 0, 0.00px)');
    expect(cards[3]!.style.visibility).toBe('hidden'); // directly behind
    expect(Number(cards[0]!.style.getPropertyValue('--ane-depth'))).toBe(0);
    expect(errors).not.toHaveBeenCalled();
    el.remove();
    expect(getTickerStats().subscribers).toBe(0);
  });
});
