// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';
import { Manager, Reference, Popper } from 'react-popper';
import type { StrictModifiers } from '@popperjs/core';
import type { Theme } from '../util/theme';
import { themeClassName } from '../util/theme';
import { refMerger } from '../util/refMerger';
import { offsetDistanceModifier } from '../util/popperUtil';

type EventWrapperPropsType = {
  children: React.ReactNode;
  onHoverChanged: (_: boolean) => void;
};

// React doesn't reliably fire `onMouseLeave` or `onMouseOut` events if wrapping a
//   disabled button. This uses native browser events to avoid that.
//
// See <https://lecstor.com/react-disabled-button-onmouseleave/>.
const TooltipEventWrapper = React.forwardRef<
  HTMLSpanElement,
  EventWrapperPropsType
>(({ onHoverChanged, children }, ref) => {
  const wrapperRef = React.useRef<HTMLSpanElement | null>(null);

  const on = React.useCallback(() => {
    onHoverChanged(true);
  }, [onHoverChanged]);

  const off = React.useCallback(() => {
    onHoverChanged(false);
  }, [onHoverChanged]);

  const onFocus = React.useCallback(() => {
    if (window.getInteractionMode() === 'keyboard') {
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
  direction?: TooltipPlacement;
  popperModifiers?: Array<StrictModifiers>;
  sticky?: boolean;
  theme?: Theme;
};

export const Tooltip: React.FC<PropsType> = ({
  children,
  className,
  content,
  direction,
  sticky,
  theme,
  popperModifiers = [],
}) => {
  const [isHovering, setIsHovering] = React.useState(false);

  const showTooltip = isHovering || Boolean(sticky);

  const tooltipThemeClassName = theme
    ? `module-tooltip--${themeClassName(theme)}`
    : undefined;

  return (
    <Manager>
      <Reference>
        {({ ref }) => (
          <TooltipEventWrapper ref={ref} onHoverChanged={setIsHovering}>
            {children}
          </TooltipEventWrapper>
        )}
      </Reference>
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
              <div
                className="module-tooltip-arrow"
                ref={arrowProps.ref}
                style={arrowProps.style}
              />
            </div>
          )
        }
      </Popper>
    </Manager>
  );
};
