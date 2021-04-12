// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';
import { Manager, Reference, Popper } from 'react-popper';
import { Theme, themeClassName } from '../util/theme';
import { multiRef } from '../util/multiRef';

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
      onFocus={on}
      onBlur={off}
      ref={multiRef<HTMLSpanElement>(ref, wrapperRef)}
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
  direction?: TooltipPlacement;
  sticky?: boolean;
  theme?: Theme;
};

export const Tooltip: React.FC<PropsType> = ({
  children,
  content,
  direction,
  sticky,
  theme,
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
      <Popper placement={direction}>
        {({ arrowProps, placement, ref, style }) =>
          showTooltip && (
            <div
              className={classNames('module-tooltip', tooltipThemeClassName)}
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
