// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import FocusTrap from 'focus-trap-react';
import type { SpringValues } from '@react-spring/web';
import { animated } from '@react-spring/web';
import classNames from 'classnames';
import { noop } from 'lodash';

import type { ModalConfigType } from '../hooks/useAnimated';
import type { Theme } from '../util/theme';
import { assertDev } from '../util/assert';
import { getClassNamesFor } from '../util/getClassNamesFor';
import { themeClassName } from '../util/theme';
import { useEscapeHandling } from '../hooks/useEscapeHandling';
import { usePrevious } from '../hooks/usePrevious';
import { handleOutsideClick } from '../util/handleOutsideClick';
import * as log from '../logging/log';

export const ModalContainerContext = React.createContext<HTMLElement | null>(
  null
);

export type PropsType = Readonly<{
  children: React.ReactElement;
  modalName: string;
  moduleClassName?: string;
  noEscapeClose?: boolean;
  noMouseClose?: boolean;
  onClose: () => unknown;
  onEscape?: () => unknown;
  onTopOfEverything?: boolean;
  overlayStyles?: SpringValues<ModalConfigType>;
  theme?: Theme;
  useFocusTrap?: boolean;
}>;

export const ModalHost = React.memo(function ModalHostInner({
  children,
  modalName,
  moduleClassName,
  noEscapeClose,
  noMouseClose,
  onClose,
  onEscape,
  onTopOfEverything,
  overlayStyles,
  theme,
  useFocusTrap = true,
}: PropsType) {
  const [root, setRoot] = React.useState<HTMLElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const previousModalName = usePrevious(modalName, modalName);
  const modalContainer = useContext(ModalContainerContext) ?? document.body;

  if (previousModalName !== modalName) {
    log.error(
      `ModalHost detected conflict between ${previousModalName} ` +
        `and ${modalName}. Consider using "key" attributes on both modals.`
    );
    assertDev(false, 'Modal conflict');
  }

  useEffect(() => {
    const div = document.createElement('div');
    modalContainer.appendChild(div);
    setRoot(div);

    return () => {
      modalContainer.removeChild(div);
      setRoot(null);
    };
  }, [modalContainer]);

  useEscapeHandling(noEscapeClose ? noop : onEscape || onClose);
  useEffect(() => {
    if (noMouseClose) {
      return noop;
    }
    return handleOutsideClick(
      node => {
        // ignore clicks that originate in the calling/pip
        // when we're not handling a component in the calling/pip
        if (
          modalContainer === document.body &&
          node instanceof Element &&
          node.closest('.module-calling__modal-container')
        ) {
          return false;
        }
        onClose();
        return true;
      },
      { containerElements: [containerRef], name: modalName }
    );
  }, [noMouseClose, onClose, containerRef, modalName, modalContainer]);

  const className = classNames([
    theme ? themeClassName(theme) : undefined,
    onTopOfEverything ? 'module-modal-host--on-top-of-everything' : undefined,
  ]);
  const getClassName = getClassNamesFor('module-modal-host', moduleClassName);

  const modalContent = (
    <div className={className}>
      <animated.div
        role="presentation"
        className={getClassName('__overlay')}
        style={overlayStyles}
      />
      <div className={getClassName('__overlay-container')}>
        <div ref={containerRef} className={getClassName('__width-container')}>
          {children}
        </div>
      </div>
    </div>
  );

  return root
    ? createPortal(
        useFocusTrap ? (
          <FocusTrap
            focusTrapOptions={{
              allowOutsideClick: ({ target }) => {
                if (!target || !(target instanceof HTMLElement)) {
                  return false;
                }

                // Exemptions:
                // - Quill suggestions since they are placed in the document.body
                // - Calling module (and pip) are always above everything else
                const exemptParent = target.closest(
                  '.module-composition-input__suggestions, ' +
                    '.module-composition-input__format-menu, ' +
                    '.module-calling__modal-container'
                );
                if (exemptParent) {
                  return true;
                }
                return false;
              },
            }}
          >
            {modalContent}
          </FocusTrap>
        ) : (
          modalContent
        ),
        root
      )
    : null;
});
