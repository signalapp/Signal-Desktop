// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode, JSX } from 'react';
import { useCallback } from 'react';
import classNames from 'classnames';
import { Popover, Tooltip } from 'radix-ui';
import { ThemeType } from '../../../types/Util.std.ts';
import { tw } from '../../../axo/tw.dom.tsx';
import { AxoBaseLayer } from '../../../axo/_internal/AxoBaseLayer.dom.tsx';

export type FunPopoverPlacement = 'top' | 'top start' | 'bottom';

type SideAndAlign = Readonly<{
  side: Popover.PopoverContentProps['side'];
  align: Popover.PopoverContentProps['align'];
}>;

const SidesAndAligns: Record<FunPopoverPlacement, SideAndAlign> = {
  top: { side: 'top', align: 'center' },
  'top start': { side: 'top', align: 'start' },
  bottom: { side: 'bottom', align: 'center' },
};

export type FunPopoverProps = Readonly<{
  /** Usually the id of the `Popover.Trigger` */
  'aria-labelledby': string;
  placement?: FunPopoverPlacement;
  theme?: ThemeType;
  children: ReactNode;
}>;

/** Must be rendered inside a `Popover.Root` */
export function FunPopover(props: FunPopoverProps): JSX.Element {
  const { side, align } = SidesAndAligns[props.placement ?? 'bottom'];

  const handleInteractOutside = useCallback((event: Event) => {
    const { target } = event;
    if (!(target instanceof Element)) {
      return;
    }
    const match = target.closest(
      [
        // Don't close when quill steals focus
        '.module-composition-input__input',
        // Don't close when clicking tooltip
        '.FunTooltip',
      ].join(', ')
    );
    if (match != null) {
      event.preventDefault();
    }
  }, []);

  const handleEscapeKeyDown = useCallback((event: KeyboardEvent) => {
    // Keep page-level Escape handlers (like the composer's) from also running
    event.stopPropagation();
  }, []);

  return (
    <Popover.Portal>
      <AxoBaseLayer>
        <Tooltip.Provider>
          <Popover.Content
            aria-labelledby={props['aria-labelledby']}
            className={classNames(
              'FunPopover',
              {
                // oxlint-disable-next-line signal-desktop/enforce-class-name-has-styles
                'light-theme': props.theme === ThemeType.light,
                'dark-theme': props.theme === ThemeType.dark,
              },
              tw('legacy-z-index-above-popup')
            )}
            side={side}
            align={align}
            sideOffset={8}
            collisionPadding={12}
            onInteractOutside={handleInteractOutside}
            onEscapeKeyDown={handleEscapeKeyDown}
          >
            <div className="FunPopover__Dialog">{props.children}</div>
          </Popover.Content>
        </Tooltip.Provider>
      </AxoBaseLayer>
    </Popover.Portal>
  );
}
