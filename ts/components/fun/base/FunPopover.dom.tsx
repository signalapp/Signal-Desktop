// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, JSX } from 'react';
import { useCallback } from 'react';
import type { Placement } from 'react-aria';
import { Dialog, Popover } from 'react-aria-components';
import classNames from 'classnames';
import { Tooltip } from 'radix-ui';
import { ThemeType } from '../../../types/Util.std.ts';
import { tw } from '../../../axo/tw.dom.tsx';

export type FunPopoverProps = Readonly<{
  placement?: Placement;
  theme?: ThemeType;
  children: ReactNode;
}>;

export function FunPopover(props: FunPopoverProps): JSX.Element {
  const shouldCloseOnInteractOutside = useCallback(
    (element: Element): boolean => {
      const match = element.closest(
        [
          // Don't close when quill steals focus
          '.module-composition-input__input',
          // Don't close when clicking tooltip
          '.FunTooltip',
        ].join(', ')
      );
      if (match != null) {
        return false;
      }
      return true;
    },
    []
  );

  return (
    <Tooltip.Provider>
      <Popover
        data-fun-overlay
        className={classNames(
          'FunPopover',
          {
            // oxlint-disable-next-line signal-desktop/enforce-class-name-has-styles
            'light-theme': props.theme === ThemeType.light,
            'dark-theme': props.theme === ThemeType.dark,
          },
          tw('legacy-z-index-popup')
        )}
        placement={props.placement}
        shouldCloseOnInteractOutside={shouldCloseOnInteractOutside}
        style={{
          // Remove the default z-index that React Aria's <Popover> adds
          zIndex: undefined,
        }}
      >
        <Dialog className="FunPopover__Dialog">{props.children}</Dialog>
      </Popover>
    </Tooltip.Provider>
  );
}
