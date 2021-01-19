// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';
import { Manager, Reference, Popper, PopperProps } from 'react-popper';
import { Theme, themeClassName } from '../util/theme';

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

  React.useEffect(() => {
    const wrapperEl = wrapperRef.current;

    if (!wrapperEl) {
      return noop;
    }

    const on = () => {
      onHoverChanged(true);
    };
    const off = () => {
      onHoverChanged(false);
    };

    wrapperEl.addEventListener('focus', on);
    wrapperEl.addEventListener('blur', off);
    wrapperEl.addEventListener('mouseenter', on);
    wrapperEl.addEventListener('mouseleave', off);

    return () => {
      wrapperEl.removeEventListener('focus', on);
      wrapperEl.removeEventListener('blur', off);
      wrapperEl.removeEventListener('mouseenter', on);
      wrapperEl.removeEventListener('mouseleave', off);
    };
  }, [onHoverChanged]);

  return (
    <span
      // This is a forward ref that also needs a ref of its own, so we set both here.
      ref={el => {
        wrapperRef.current = el;

        // This is a simplified version of [what React does][0] to set a ref.
        // [0]: https://github.com/facebook/react/blob/29b7b775f2ecf878eaf605be959d959030598b07/packages/react-reconciler/src/ReactFiberCommitWork.js#L661-L677
        if (typeof ref === 'function') {
          ref(el);
        } else if (ref) {
          // I believe the types for `ref` are wrong in this case, as `ref.current` should
          //   not be `readonly`. That's why we do this cast. See [the React source][1].
          // [1]: https://github.com/facebook/react/blob/29b7b775f2ecf878eaf605be959d959030598b07/packages/shared/ReactTypes.js#L78-L80
          // eslint-disable-next-line no-param-reassign
          (ref as React.MutableRefObject<HTMLSpanElement | null>).current = el;
        }
      }}
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
  popperModifiers?: PopperProps['modifiers'];
  sticky?: boolean;
  theme?: Theme;
};

export const Tooltip: React.FC<PropsType> = ({
  children,
  content,
  direction,
  sticky,
  theme,
  popperModifiers,
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
      <Popper placement={direction} modifiers={popperModifiers || undefined}>
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
