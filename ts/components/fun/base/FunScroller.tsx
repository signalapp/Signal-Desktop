// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { mergeRefs } from '@react-aria/utils';
import classNames from 'classnames';
import { maxBy } from 'lodash';
import type { CSSProperties, ReactNode, Ref } from 'react';
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  isScrollAtBottom,
  isScrollAtTop,
  isScrollOverflowVertical,
  useScrollObserver,
} from '../../../hooks/useSizeObserver';
import { strictAssert } from '../../../util/assert';

export type FunScrollerProps = Readonly<{
  sectionGap: number;
  onScrollSectionChange?: (id: string) => void;
  children: ReactNode;
}>;

type ScrollerSectionUnobserve = () => void;
type ScrollerSectionObserve = (element: Element) => ScrollerSectionUnobserve;

const ScrollerSectionObserveContext =
  createContext<ScrollerSectionObserve | null>(null);

export const FunScroller = forwardRef(function FunScroller(
  props: FunScrollerProps,
  ref: Ref<HTMLDivElement>
): JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollerInnerRef = useRef<HTMLDivElement>(null);

  const [scrollAtTop, setScrollAtTop] = useState(false);
  const [scrollAtBottom, setScrollAtBottom] = useState(false);
  const [scrollVerticalOverflow, setScrollOverflowVertical] = useState(false);

  useScrollObserver(scrollerRef, scrollerInnerRef, scroll => {
    setScrollAtTop(isScrollAtTop(scroll));
    setScrollAtBottom(isScrollAtBottom(scroll));
    setScrollOverflowVertical(isScrollOverflowVertical(scroll));
  });

  const showTopScrollHint = scrollVerticalOverflow && !scrollAtTop;
  const showBottomScrollHint = scrollVerticalOverflow && !scrollAtBottom;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const onScrollChangeRef = useRef(props.onScrollSectionChange);
  useEffect(() => {
    onScrollChangeRef.current = props.onScrollSectionChange;
  }, [props.onScrollSectionChange]);

  useEffect(() => {
    const scrollerElement = scrollerRef.current;
    strictAssert(scrollerElement, 'Expected scrollerRef.current to be defined');

    const options: IntersectionObserverInit = {
      threshold: 0, // 1px is visible (within margin)
      rootMargin: `-${props.sectionGap}px 0px -${props.sectionGap}px 0px`,
      root: scrollerElement,
    };

    type HistoryItem = { id: string; time: number };
    const history = new Map<string, HistoryItem>();
    let lastId: string | null = null;

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const { id } = entry.target;
        strictAssert(id, 'Observed element must have an id');
        if (entry.isIntersecting) {
          history.set(id, { id, time: entry.time });
        } else {
          history.delete(id);
        }
      }

      const stack = Array.from(history.values());
      const needle = maxBy(stack, x => x.time);

      if (needle != null && needle.id !== lastId) {
        lastId = needle.id;
        onScrollChangeRef.current?.(needle.id);
      }
    }, options);

    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [props.sectionGap]);

  const observe: ScrollerSectionObserve = useCallback((element: Element) => {
    const observer = observerRef.current;
    strictAssert(observer, 'Expected observerRef.current to be defined');
    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, []);

  return (
    <div className="FunScroller__Container">
      <div
        className={classNames(
          'FunScroller__Hint',
          'FunScroller__Hint--Top',
          showTopScrollHint && 'FunScroller__Hint--Visible'
        )}
      />
      <div
        className={classNames(
          'FunScroller__Hint',
          'FunScroller__Hint--Bottom',
          showBottomScrollHint && 'FunScroller__Hint--Visible'
        )}
      />
      <div
        ref={mergeRefs(scrollerRef, ref)}
        className="FunScroller__Viewport"
        // Nested scrollable elements should be focusable
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        <ScrollerSectionObserveContext.Provider value={observe}>
          <div ref={scrollerInnerRef} className="FunScroller__ViewportInner">
            {props.children}
          </div>
        </ScrollerSectionObserveContext.Provider>
      </div>
    </div>
  );
});

export type FunScrollerSectionProps = Readonly<{
  id: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}>;

export function FunScrollerSection(
  props: FunScrollerSectionProps
): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const observe = useContext(ScrollerSectionObserveContext);
  strictAssert(observe, 'Expected observe to be defined');

  useEffect(() => {
    const element = ref.current;
    strictAssert(element, 'Expected ref.current to be defined');
    return observe(element);
  }, [observe]);

  return (
    <section
      ref={ref}
      id={props.id}
      className={classNames('FunScroller__Section', props.className)}
      style={props.style}
    >
      {props.children}
    </section>
  );
}
