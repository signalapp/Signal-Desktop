// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useContext,
  useEffect,
  createContext,
  memo,
  useRef,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import type { SpringValues } from '@react-spring/web';
import { animated } from '@react-spring/web';
import classNames from 'classnames';
import lodash from 'lodash';
import { FocusScope } from 'react-aria';
import type { ModalConfigType } from '../hooks/useAnimated.dom.tsx';
import type { Theme } from '../util/theme.std.ts';
import { assertDev } from '../util/assert.std.ts';
import { themeClassName } from '../util/theme.std.ts';
import { useEscapeHandling } from '../hooks/useEscapeHandling.dom.ts';
import { usePreviousDeprecated } from '../hooks/usePrevious.std.ts';
import { handleOutsideClick } from '../util/handleOutsideClick.dom.ts';
import { createLogger } from '../logging/log.std.ts';

const { noop } = lodash;

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousModalName = usePreviousDeprecated(modalName, modalName);
  const modalContainer = useContext(ModalContainerContext) ?? document.body;

  if (previousModalName !== modalName) {
    log.error(
      `detected conflict between ${previousModalName} ` +
        `and ${modalName}. Consider using "key" attributes on both modals.`
    );
    assertDev(false, 'Modal conflict');
  }

  useEscapeHandling(noEscapeClose ? noop : onEscape || onClose);
  useEffect(() => {
    if (noMouseClose) {
      return noop;
    }
    return handleOutsideClick(
      node => {
        // In strange event propagation situations we can get the actual document.body
        // node here. We don't want to handle those events.
        if (node === document.body || node === document.documentElement) {
          return false;
        }

        // ignore clicks that originate in the calling/pip
        // when we're not handling a component in the calling/pip
        if (
          (modalContainer === document.body ||
            modalContainer.classList.contains(
              'module-calling__modal-container'
            )) &&
          node instanceof Element &&
          node.closest(
            [
              '.module-calling__modal-container',
              '[data-fun-overlay]',
              '[data-radix-popper-content-wrapper]',
            ].join(', ')
          ) != null
        ) {
          return false;
        }
        onClose();
        return true;
      },
      { containerElements: [containerRef], name: modalName }
    );
  }, [noMouseClose, onClose, containerRef, modalName, modalContainer]);

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
        <div ref={containerRef} className="module-modal-host__width-container">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <FocusScope contain={false} autoFocus restoreFocus>
      {modalContent}
    </FocusScope>,
    document.body
  );
});
