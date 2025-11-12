// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from './assert.dom.js';

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
  #scroller: HTMLDivElement;
  #current: ScrollbarGutters;
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

    this.#scroller = scroller;
    this.#current = this.#compute();
    this.#observer = new ResizeObserver(() => this.#update());
    this.#observer.observe(this.#scroller, { box: 'content-box' });
  }

  #compute(): ScrollbarGutters {
    const { offsetWidth, offsetHeight, clientWidth, clientHeight } =
      this.#scroller;

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
      next.vertical === this.#current.vertical &&
      next.horizontal === this.#current.horizontal
    ) {
      return;
    }

    this.#current = next;

    this.#listeners.forEach(listener => {
      listener();
    });
  }

  current(): ScrollbarGutters {
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

  function update() {
    const value = observer.current();
    root.style.setProperty(verticalProperty, `${value.vertical}px`);
    root.style.setProperty(horizontalProperty, `${value.horizontal}px`);
  }

  update();
  const unsubscribe = observer.subscribe(update);
  return () => {
    unsubscribe();
    root.style.removeProperty(verticalProperty);
    root.style.removeProperty(horizontalProperty);
  };
}

export function createScrollbarGutterCssProperties(): Unsubscribe {
  const autoUnsubscribe = applyGlobalProperties(
    new ScrollbarGuttersObserver('auto'),
    '--axo-scrollbar-gutter-auto-vertical',
    '--axo-scrollbar-gutter-auto-horizontal'
  );

  const thinUnsubscribe = applyGlobalProperties(
    new ScrollbarGuttersObserver('thin'),
    '--axo-scrollbar-gutter-thin-vertical',
    '--axo-scrollbar-gutter-thin-horizontal'
  );

  return () => {
    autoUnsubscribe();
    thinUnsubscribe();
  };
}
