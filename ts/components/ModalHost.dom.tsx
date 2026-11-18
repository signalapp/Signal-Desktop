// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useCallback,
  useContext,
  createContext,
  memo,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import type { SpringValues } from '@react-spring/web';
import { animated } from '@react-spring/web';
import classNames from 'classnames';
import { DismissableLayer, FocusScope } from 'radix-ui/internal';
import type { ModalConfigType } from '../hooks/useAnimated.dom.tsx';
import type { Theme } from '../util/theme.std.ts';
import { assertDev } from '../util/assert.std.ts';
import { themeClassName } from '../util/theme.std.ts';
import { usePreviousDeprecated } from '../hooks/usePrevious.std.ts';
import { createLogger } from '../logging/log.std.ts';

const log = createLogger('ModalHost');

export const ModalContainerContext = createContext<HTMLElement | null>(null);

export type PropsType = Readonly<{
  children: ReactElement;
  modalName: string;
  /** @deprecated */
  className?: string;
  noEscapeClose?: boolean;
  noMouseClose?: boolean;
  onClose: () => unknown;
  onEscape?: () => unknown;
  onTopOfEverything?: boolean;
  overlayStyles?: SpringValues<ModalConfigType>;
  theme?: Theme;
}>;

export const ModalHost = memo(function ModalHostInner({
  children,
  modalName,
  className,
  noEscapeClose,
  noMouseClose,
  onClose,
  onEscape,
  onTopOfEverything,
  overlayStyles,
  theme,
}: PropsType) {
  const previousModalName = usePreviousDeprecated(modalName, modalName);
  const modalContainer = useContext(ModalContainerContext) ?? document.body;

  if (previousModalName !== modalName) {
    log.error(
      `detected conflict between ${previousModalName} ` +
        `and ${modalName}. Consider using "key" attributes on both modals.`
    );
    assertDev(false, 'Modal conflict');
  }

  const handleEscapeKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // The modal handles Escape itself, even when it doesn't close
      event.preventDefault();
      if (!noEscapeClose) {
        (onEscape ?? onClose)();
      }
    },
    [noEscapeClose, onEscape, onClose]
  );

  const handlePointerDownOutside = useCallback(
    (event: Event) => {
      const { target } = event;
      if (noMouseClose) {
        event.preventDefault();
        return;
      }
      // In strange event propagation situations we can get the actual
      // document.body node here. We don't want to handle those events.
      if (target === document.body || target === document.documentElement) {
        event.preventDefault();
        return;
      }
      // Ignore clicks in the call screen/PiP when this modal isn't part of it
      if (
        (modalContainer === document.body ||
          modalContainer.classList.contains(
            'module-calling__modal-container'
          )) &&
        target instanceof Element &&
        target.closest('.module-calling__modal-container') != null
      ) {
        event.preventDefault();
      }
    },
    [noMouseClose, modalContainer]
  );

  const modalContent = (
    <div
      className={classNames([
        theme ? themeClassName(theme) : undefined,
        onTopOfEverything
          ? 'module-modal-host--on-top-of-everything'
          : undefined,
        className,
      ])}
    >
      <animated.div
        role="presentation"
        className="module-modal-host__overlay"
        style={overlayStyles}
      />
      <div className="module-modal-host__overlay-container">
        <DismissableLayer.Root
          asChild
          onEscapeKeyDown={handleEscapeKeyDown}
          onPointerDownOutside={handlePointerDownOutside}
          onFocusOutside={event => event.preventDefault()}
          onDismiss={onClose}
        >
          <div className="module-modal-host__width-container">{children}</div>
        </DismissableLayer.Root>
      </div>
    </div>
  );

  return createPortal(
    // Moves focus in and back out, without trapping it
    <FocusScope.Root asChild>{modalContent}</FocusScope.Root>,
    document.body
  );
});
