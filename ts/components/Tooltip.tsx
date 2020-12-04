// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Manager, Reference, Popper } from 'react-popper';
import { Theme, themeClassName } from '../util/theme';

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
  const isSticky = Boolean(sticky);
  const [showTooltip, setShowTooltip] = React.useState(isSticky);

  const tooltipTheme = theme ? themeClassName(theme) : undefined;

  return (
    <Manager>
      <Reference>
        {({ ref }) => (
          <span
            onBlur={() => {
              if (!isSticky) {
                setShowTooltip(false);
              }
            }}
            onFocus={() => {
              if (!isSticky) {
                setShowTooltip(true);
              }
            }}
            onMouseEnter={() => {
              if (!isSticky) {
                setShowTooltip(true);
              }
            }}
            onMouseLeave={() => {
              if (!isSticky) {
                setShowTooltip(false);
              }
            }}
            ref={ref}
          >
            {children}
          </span>
        )}
      </Reference>
      <Popper placement={direction}>
        {({ arrowProps, placement, ref, style }) =>
          showTooltip && (
            <div className={tooltipTheme}>
              <div
                className="module-tooltip"
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
            </div>
          )
        }
      </Popper>
    </Manager>
  );
};
