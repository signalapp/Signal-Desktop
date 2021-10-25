// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { Manager, Reference, Popper } from 'react-popper';
import type { StrictModifiers } from '@popperjs/core';
import { Theme, themeClassName } from '../util/theme';
import { offsetDistanceModifier } from '../util/popperUtil';

import { SmartTooltipEventWrapper } from '../state/smart/TooltipEventWrapper';

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
          <SmartTooltipEventWrapper
            innerRef={ref}
            onHoverChanged={setIsHovering}
          >
            {children}
          </SmartTooltipEventWrapper>
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
