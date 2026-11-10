import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineElement, EffectElement } from './effect-element';
import { getTickerStats } from './ticker';

/** Captures IntersectionObserver callbacks so tests can scroll elements in and out of view. */
class FakeObserver {
  static instances: FakeObserver[] = [];
  constructor(public callback: IntersectionObserverCallback) {
    FakeObserver.instances.push(this);
  }
  observe(): void {}
  disconnect(): void {}
  fire(visible: boolean): void {
    this.callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

class ProbeElement extends EffectElement {
  visibility: boolean[] = [];
  protected build(root: ShadowRoot): void {
    root.innerHTML = '<span></span>';
  }
  protected tick(): void {}
  protected override visibilityChanged(visible: boolean): void {
    this.visibility.push(visible, this.onScreen);
  }
}
defineElement('ane-probe', ProbeElement);

describe('EffectElement visibility', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    FakeObserver.instances = [];
    vi.unstubAllGlobals();
  });

  it('reports scrolling out of and back into view, and pauses the loop meanwhile', () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const el = document.createElement('ane-probe') as ProbeElement;
    document.body.append(el);
    const observer = FakeObserver.instances[0]!;
    expect(getTickerStats().subscribers).toBe(1);

    observer.fire(true); // initial "visible" report is not a change
    expect(el.visibility).toEqual([]);
    observer.fire(false);
    expect(el.visibility).toEqual([false, false]);
    expect(getTickerStats().subscribers).toBe(0);
    observer.fire(true);
    expect(el.visibility).toEqual([false, false, true, true]);
    expect(getTickerStats().subscribers).toBe(1);
    el.remove();
  });
});
