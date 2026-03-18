// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from './assert.std.js';

export type ScrollbarWidth = 'auto' | 'thin' | 'none';

export type ScrollbarGutters = Readonly<{
  vertical: number;
  horizontal: number;
}>;

function isValidClientSize(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

type Listener = () => void;
type Unsubscribe = () => void;

class ScrollbarGuttersObserver {
  #container: HTMLDivElement;
  #scroller: HTMLDivElement;
  #current: ScrollbarGutters | null;
  #observer: ResizeObserver;
  #listeners = new Set<Listener>();

  constructor(scrollbarWidth: Exclude<ScrollbarWidth, 'none'>) {
    const container = document.createElement('div');
    container.dataset.scrollbarGuttersObserver = scrollbarWidth;

    // Insert the element into the DOM to get non-zero measurements
    document.body.append(container);

    const scroller = document.createElement('div');
    const content = document.createElement('div');

    // Use `all: initial` to avoid other styles affecting the measurement
    // This resets elements to their initial value (such as `display: inline`)
    scroller.style.setProperty('all', 'initial');
    scroller.style.setProperty('position', 'absolute');
    scroller.style.setProperty('top', '-9999px');
    scroller.style.setProperty('left', '-9999px');
    scroller.style.setProperty('display', 'block');
    scroller.style.setProperty('visibility', 'hidden');
    scroller.style.setProperty('overflow', 'auto');
    scroller.style.setProperty('width', '100px');
    scroller.style.setProperty('height', '100px');
    scroller.style.setProperty('scrollbar-width', scrollbarWidth);
    scroller.style.setProperty('scrollbar-color', 'black transparent');

    content.style.setProperty('all', 'initial');
    content.style.setProperty('display', 'block');
    content.style.setProperty('width', '101px');
    content.style.setProperty('height', '101px');

    scroller.append(content);
    container.append(scroller);

    this.#container = container;
    this.#scroller = scroller;
    this.#current = this.#compute();
    this.#observer = new ResizeObserver(() => this.#update());
    this.#observer.observe(this.#scroller, { box: 'content-box' });
  }

  destroy() {
    this.#observer.disconnect();
    this.#container.remove();
  }

  #compute(): ScrollbarGutters | null {
    const { offsetWidth, offsetHeight, clientWidth, clientHeight } =
      this.#scroller;

    if (offsetWidth === 0 || offsetHeight === 0) {
      // If the element is not properly rendered, we might get zero sizes.
      // In that case, we should return zeros instead of throwing an error.
      return null;
    }

    assert(offsetWidth === 100, 'offsetWidth must be exactly 100px');
    assert(offsetHeight === 100, 'offsetHeight must be exactly 100px');
    assert(
      isValidClientSize(clientWidth),
      'clientWidth must be non-zero positive integer'
    );
    assert(
      isValidClientSize(clientHeight),
      'clientHeight must be non-zero positive integer'
    );

    const vertical = offsetWidth - clientWidth;
    const horizontal = offsetHeight - clientHeight;

    return { vertical, horizontal };
  }

  #update() {
    const next = this.#compute();

    if (
      next?.vertical === this.#current?.vertical &&
      next?.horizontal === this.#current?.horizontal
    ) {
      return;
    }

    this.#current = next;

    this.#listeners.forEach(listener => {
      listener();
    });
  }

  current(): ScrollbarGutters | null {
    return this.#current;
  }

  subscribe(listener: Listener): Unsubscribe {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}

function applyGlobalProperties(
  observer: ScrollbarGuttersObserver,
  verticalProperty: `--${string}`,
  horizontalProperty: `--${string}`
): Unsubscribe {
  const root = document.documentElement;

  function removeProperties() {
    root.style.removeProperty(verticalProperty);
    root.style.removeProperty(horizontalProperty);
  }

  function update() {
    const value = observer.current();
    if (value != null) {
      root.style.setProperty(verticalProperty, `${value.vertical}px`);
      root.style.setProperty(horizontalProperty, `${value.horizontal}px`);
    } else {
      removeProperties();
    }
  }

  update();
  const unsubscribe = observer.subscribe(update);
  return () => {
    unsubscribe();
    removeProperties();
  };
}

export function createScrollbarGutterCssProperties(): Unsubscribe {
  const autoObserver = new ScrollbarGuttersObserver('auto');
  const thinObserver = new ScrollbarGuttersObserver('thin');

  const autoUnsubscribe = applyGlobalProperties(
    autoObserver,
    '--axo-scrollbar-gutter-auto-vertical',
    '--axo-scrollbar-gutter-auto-horizontal'
  );

  const thinUnsubscribe = applyGlobalProperties(
    thinObserver,
    '--axo-scrollbar-gutter-thin-vertical',
    '--axo-scrollbar-gutter-thin-horizontal'
  );

  return () => {
    autoUnsubscribe();
    thinUnsubscribe();
    autoObserver.destroy();
    thinObserver.destroy();
  };
}
