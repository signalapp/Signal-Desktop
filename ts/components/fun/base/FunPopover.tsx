// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import React, { useCallback } from 'react';
import type { Placement } from 'react-aria';
import { Dialog, Popover } from 'react-aria-components';
import classNames from 'classnames';
import { ThemeType } from '../../../types/Util';

export type FunPopoverProps = Readonly<{
  placement?: Placement;
  theme?: ThemeType;
  children: ReactNode;
}>;

export function FunPopover(props: FunPopoverProps): JSX.Element {
  const shouldCloseOnInteractOutside = useCallback(
    (element: Element): boolean => {
      // Don't close when quill steals focus
      const match = element.closest('.module-composition-input__input');
      if (match != null) {
        return false;
      }
      return true;
    },
    []
  );

  return (
    <Popover
      data-fun-overlay
      className={classNames('FunPopover', {
        'light-theme': props.theme === ThemeType.light,
        'dark-theme': props.theme === ThemeType.dark,
      })}
      placement={props.placement}
      shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
    >
      <Dialog className="FunPopover__Dialog">{props.children}</Dialog>
    </Popover>
  );
}
