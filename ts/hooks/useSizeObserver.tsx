// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { strictAssert } from '../util/assert';

export type Size = Readonly<{
  width: number;
  height: number;
}>;

export type SizeChangeHandler = (size: Size) => void;

export function isSameSize(a: Size, b: Size): boolean {
  return a.width === b.width && a.height === b.height;
}

export function useSizeObserver<T extends Element = Element>(
  ref: RefObject<T>,
  /**
   * Note: If you provide `onSizeChange`, `useSizeObserver()` will always return `null`
   */
  onSizeChange?: SizeChangeHandler
): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  const sizeRef = useRef<Size | null>(null);
  const onSizeChangeRef = useRef<SizeChangeHandler | void>(onSizeChange);
  useEffect(() => {
    // This means you don't need to wrap `onSizeChange` with `useCallback()`
    onSizeChangeRef.current = onSizeChange;
  }, [onSizeChange]);
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      // It's possible that ResizeObserver emit entries after disconnect()
      if (ref.current == null) {
        return;
      }
      // We're only ever observing one element, and `ResizeObserver` for some
      // reason is an array of exactly one rect (I assume to support wrapped
      // inline elements in the future)
      const borderBoxSize = entries[0].borderBoxSize[0];
      // We are assuming a horizontal writing-mode here, we could call
      // `getBoundingClientRect()` here but MDN says not to. In the future if
      // we are adding support for a vertical locale we may need to change this
      const next: Size = {
        width: borderBoxSize.inlineSize,
        height: borderBoxSize.blockSize,
      };
      const prev = sizeRef.current;
      if (prev == null || !isSameSize(prev, next)) {
        sizeRef.current = next;
        if (onSizeChangeRef.current != null) {
          onSizeChangeRef.current(next);
        } else {
          setSize(next);
        }
      }
    });
    strictAssert(
      ref.current instanceof Element,
      'ref must be assigned to an element'
    );
    observer.observe(ref.current, {
      box: 'border-box',
    });
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return size;
}

// Note we use `any` for ref below because TypeScript doesn't currently have
// good inference for JSX generics and it creates confusing errors. We have
// a better error being reported by the hook.

export type SizeObserverProps = Readonly<{
  /**
   * Note: If you provide `onSizeChange`, in `children()` the `size` will always be `null`
   */
  onSizeChange?: SizeChangeHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children(ref: RefObject<any>, size: Size | null): JSX.Element;
}>;

export function SizeObserver({
  onSizeChange,
  children,
}: SizeObserverProps): JSX.Element {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>();
  const size = useSizeObserver(ref, onSizeChange);
  return children(ref, size);
}

// Note: You should just be able to pass an element into utils if you want.
export type Scroll = Readonly<
  Pick<
    Element,
    | 'scrollTop'
    | 'scrollHeight'
    | 'clientHeight'
    | 'scrollLeft'
    | 'scrollWidth'
    | 'clientWidth'
  >
>;

export type ScrollChangeHandler = (scroll: Scroll) => void;

export function isSameScroll(a: Scroll, b: Scroll): boolean {
  return (
    a.scrollTop === b.scrollTop &&
    a.scrollHeight === b.scrollHeight &&
    a.clientHeight === b.clientHeight &&
    a.scrollLeft === b.scrollLeft &&
    a.scrollWidth === b.scrollWidth &&
    a.clientWidth === b.clientWidth
  );
}

export function isScrollOverflowVertical(scroll: Scroll): boolean {
  return scroll.scrollHeight > scroll.clientHeight;
}

export function isScrollOverflowHorizontal(scroll: Scroll): boolean {
  return scroll.scrollWidth > scroll.clientWidth;
}

export function isScrollAtTop(scroll: Scroll, threshold = 0): boolean {
  return scroll.scrollTop <= threshold;
}

export function isScrollAtLeft(scroll: Scroll, threshold = 0): boolean {
  return scroll.scrollLeft <= threshold;
}

export function isScrollAtBottom(scroll: Scroll, threshold = 0): boolean {
  const maxScrollTop = scroll.scrollHeight - scroll.clientHeight;
  return scroll.scrollTop >= maxScrollTop - threshold;
}

export function isScrollAtRight(scroll: Scroll, threshold = 0): boolean {
  const maxScrollLeft = scroll.scrollWidth - scroll.clientWidth;
  return scroll.scrollLeft >= maxScrollLeft - threshold;
}

export function getScrollTopDistance(scroll: Scroll, clamp: number): number {
  return Math.min(scroll.scrollTop, clamp);
}

export function getScrollLeftDistance(scroll: Scroll, clamp: number): number {
  return Math.min(scroll.scrollLeft, clamp);
}

export function getScrollBottomDistance(scroll: Scroll, clamp: number): number {
  return Math.min(
    scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop,
    clamp
  );
}

export function getScrollRightDistance(scroll: Scroll, clamp: number): number {
  return Math.min(
    scroll.scrollWidth - scroll.clientWidth - scroll.scrollLeft,
    clamp
  );
}

/**
 * We need an extra element because there is no ResizeObserver equivalent for
 * `scrollHeight`. You need something measuring the scroll container and an
 * inner element wrapping all of its children.
 *
 * ```
 * const scrollerRef = useRef()
 * const scrollerInnerRef = useRef()
 *
 * useScrollObserver(scrollerRef, scrollerInnerRef, (scroll) => {
 *   setScrollOverflowVertical(isScrollOverflowVertical(scroll));
 *   setScrollAtTop(isScrollAtTop(scroll));
 *   setScrollAtBottom(isScrollAtBottom(scroll));
 * })
 *
 * <div ref={scrollerRef} style={{ overflow: "auto" }}>
 *   <div ref={scrollerInnerRef}>
 *     {children}
 *   </div>
 * </div>
 * ```
 */
export function useScrollObserver(
  scrollerRef: RefObject<HTMLElement>,
  scrollerInnerRef: RefObject<HTMLElement>,
  onScrollChange: (scroll: Scroll) => void
): void {
  const scrollRef = useRef<Scroll | null>(null);
  const onScrollChangeRef = useRef<ScrollChangeHandler>(onScrollChange);

  useEffect(() => {
    // This means you don't need to wrap `onScrollChange` with `useCallback()`
    onScrollChangeRef.current = onScrollChange;
  }, [onScrollChange]);

  const onUpdate = useCallback(() => {
    const target = scrollerRef.current;
    strictAssert(
      target instanceof Element,
      'ref must be assigned to an element'
    );
    const next: Scroll = {
      scrollTop: target.scrollTop,
      scrollHeight: target.scrollHeight,
      clientHeight: target.clientHeight,
      scrollLeft: target.scrollLeft,
      scrollWidth: target.scrollWidth,
      clientWidth: target.clientWidth,
    };
    const prev = scrollRef.current;
    if (prev == null || !isSameScroll(prev, next)) {
      scrollRef.current = next;
      onScrollChangeRef.current(next);
    }
  }, [scrollerRef]);

  useSizeObserver(scrollerRef, onUpdate);
  useSizeObserver(scrollerInnerRef, onUpdate);

  useEffect(() => {
    strictAssert(
      scrollerRef.current instanceof Element,
      'ref must be assigned to an element'
    );
    const target = scrollerRef.current;
    target.addEventListener('scroll', onUpdate, { passive: true });
    return () => {
      target.removeEventListener('scroll', onUpdate);
    };
  }, [scrollerRef, onUpdate]);
}
