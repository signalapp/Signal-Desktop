// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef } from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';
import { Manager, Reference, Popper } from 'react-popper';
import type { StrictModifiers } from '@popperjs/core';
import { createPortal } from 'react-dom';
import type { Theme } from '../util/theme';
import { themeClassName } from '../util/theme';
import { refMerger } from '../util/refMerger';
import { offsetDistanceModifier } from '../util/popperUtil';
import { getInteractionMode } from '../services/InteractionMode';

type EventWrapperPropsType = {
  className?: string;
  children: React.ReactNode;
  onHoverChanged: (_: boolean) => void;
};

// React doesn't reliably fire `onMouseLeave` or `onMouseOut` events if wrapping a
//   disabled button. This uses native browser events to avoid that.
//
// See <https://lecstor.com/react-disabled-button-onmouseleave/>.
export const TooltipEventWrapper = React.forwardRef<
  HTMLSpanElement,
  EventWrapperPropsType
>(function TooltipEvent(
  { className, onHoverChanged, children },
  ref
): JSX.Element {
  const wrapperRef = React.useRef<HTMLSpanElement | null>(null);

  const on = React.useCallback(() => {
    onHoverChanged(true);
  }, [onHoverChanged]);

  const off = React.useCallback(() => {
    onHoverChanged(false);
  }, [onHoverChanged]);

  const onFocus = React.useCallback(() => {
    if (getInteractionMode() === 'keyboard') {
      on();
    }
  }, [on]);

  React.useEffect(() => {
    const wrapperEl = wrapperRef.current;

    if (!wrapperEl) {
      return noop;
    }

    wrapperEl.addEventListener('mouseenter', on);
    wrapperEl.addEventListener('mouseleave', off);

    return () => {
      wrapperEl.removeEventListener('mouseenter', on);
      wrapperEl.removeEventListener('mouseleave', off);
    };
  }, [on, off]);

  return (
    <span
      className={className}
      onFocus={onFocus}
      onBlur={off}
      ref={refMerger<HTMLSpanElement>(ref, wrapperRef)}
    >
      {children}
    </span>
  );
});

export enum TooltipPlacement {
  Top = 'top',
  Right = 'right',
  Bottom = 'bottom',
  Left = 'left',
}

export type PropsType = {
  content: string | JSX.Element;
  className?: string;
  children?: React.ReactNode;
  direction?: TooltipPlacement;
  popperModifiers?: Array<StrictModifiers>;
  sticky?: boolean;
  theme?: Theme;
  wrapperClassName?: string;
  delay?: number;
  hideArrow?: boolean;
};

let GLOBAL_EXIT_TIMER: NodeJS.Timeout | undefined;
let GLOBAL_TOOLTIP_DISABLE_DELAY = false;

export function Tooltip({
  children,
  className,
  content,
  direction,
  sticky,
  theme,
  popperModifiers = [],
  wrapperClassName,
  delay,
  hideArrow,
}: PropsType): JSX.Element {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>();
  const [active, setActive] = React.useState(false);

  const showTooltip = active || Boolean(sticky);

  const tooltipThemeClassName = theme
    ? `module-tooltip--${themeClassName(theme)}`
    : undefined;

  function handleHoverChanged(hovering: boolean) {
    // Don't accept updates that aren't valid anymore
    clearTimeout(GLOBAL_EXIT_TIMER);
    clearTimeout(timeoutRef.current);

    // We can skip past all of this if there's no delay
    if (delay != null) {
      // If we're now hovering, and delays haven't been disabled globally
      // we should start the timer to show the tooltip
      if (hovering && !GLOBAL_TOOLTIP_DISABLE_DELAY) {
        timeoutRef.current = setTimeout(() => {
          setActive(true);
          // Since we have shown a tooltip we can now disable these delays
          // globally.
          GLOBAL_TOOLTIP_DISABLE_DELAY = true;
        }, delay);
        return;
      }

      if (!hovering) {
        // If we're not hovering, we should hide the tooltip immediately
        setActive(false);

        // If we've disabled delays globally, we need to start a timer to undo
        // that after some time has passed.
        if (GLOBAL_TOOLTIP_DISABLE_DELAY) {
          GLOBAL_EXIT_TIMER = setTimeout(() => {
            GLOBAL_TOOLTIP_DISABLE_DELAY = false;

            // We're always going to use 300 here so that a tooltip with a really
            // long delay doesn't affect all of the others
          }, 300);
        }
        return;
      }
    }
    setActive(hovering);
  }

  return (
    <Manager>
      <Reference>
        {({ ref }) => (
          <TooltipEventWrapper
            className={wrapperClassName}
            ref={ref}
            onHoverChanged={handleHoverChanged}
          >
            {children}
          </TooltipEventWrapper>
        )}
      </Reference>
      {createPortal(
        <Popper
          placement={direction}
          modifiers={[offsetDistanceModifier(12), ...popperModifiers]}
        >
          {({ arrowProps, placement, ref, style }) =>
            showTooltip && (
              <div
                className={classNames(
                  'module-tooltip',
                  tooltipThemeClassName,
                  className
                )}
                ref={ref}
                style={style}
                data-placement={placement}
              >
                {content}
                {!hideArrow ? (
                  <div
                    className="module-tooltip-arrow"
                    ref={arrowProps.ref}
                    style={arrowProps.style}
                  />
                ) : null}
              </div>
            )
          }
        </Popper>,
        document.body
      )}
    </Manager>
  );
}
