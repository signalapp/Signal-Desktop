// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SpringValues } from '@react-spring/web';
import { animated } from '@react-spring/web';
import classNames from 'classnames';
import lodash from 'lodash';
import { FocusScope } from 'react-aria';
import type { ModalConfigType } from '../hooks/useAnimated.dom.js';
import type { Theme } from '../util/theme.std.js';
import { assertDev } from '../util/assert.std.js';
import { getClassNamesFor } from '../util/getClassNamesFor.std.js';
import { themeClassName } from '../util/theme.std.js';
import { useEscapeHandling } from '../hooks/useEscapeHandling.dom.js';
import { usePrevious } from '../hooks/usePrevious.std.js';
import { handleOutsideClick } from '../util/handleOutsideClick.dom.js';
import { createLogger } from '../logging/log.std.js';

const { noop } = lodash;

const log = createLogger('ModalHost');

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
}: PropsType) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const previousModalName = usePrevious(modalName, modalName);
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
        if (node === document.body) {
          return false;
        }

        // ignore clicks that originate in the calling/pip
        // when we're not handling a component in the calling/pip
        if (
          modalContainer === document.body &&
          node instanceof Element &&
          node.closest('.module-calling__modal-container, [data-fun-overlay]')
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

  return createPortal(
    <FocusScope contain autoFocus restoreFocus>
      {modalContent}
    </FocusScope>,
    document.body
  );
});
