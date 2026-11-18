// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useContext, useState } from 'react';
import type { JSX, ReactElement } from 'react';
import { Dialog } from 'radix-ui';
import classNames from 'classnames';
import { ModalContainerContext } from './ModalHost.dom.tsx';

export type CallingSidePanelProps = Readonly<{
  onClose: () => void;
  /** Overrides the default placement of the panel's row */
  rowClassName?: string;
  /** Must forward its ref and props, e.g. a `div` */
  children: ReactElement;
}>;

/**
 * A modal panel pinned to the bottom-start of the call screen, above the call
 * controls. Clicking anywhere else closes it. Label it by wrapping its title
 * in `<Dialog.Title asChild>`.
 */
export function CallingSidePanel(props: CallingSidePanelProps): JSX.Element {
  const { onClose } = props;
  const modalContainer = useContext(ModalContainerContext) ?? document.body;

  const [previouslyFocused] = useState(() => document.activeElement);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose]
  );

  // There's no `Dialog.Trigger` for Radix to return focus to
  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      event.preventDefault();
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    },
    [previouslyFocused]
  );

  return (
    <Dialog.Root open onOpenChange={handleOpenChange}>
      <Dialog.Portal container={modalContainer}>
        <Dialog.Overlay className="CallingSidePanel__Overlay" />
        <div className="CallingSidePanel__Container">
          <div
            className={classNames('CallingSidePanel__Row', props.rowClassName)}
          >
            <Dialog.Content
              asChild
              aria-describedby={undefined}
              onCloseAutoFocus={handleCloseAutoFocus}
            >
              {props.children}
            </Dialog.Content>
          </div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
