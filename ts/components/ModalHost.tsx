// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import FocusTrap from 'focus-trap-react';
import type { SpringValues } from '@react-spring/web';
import { animated } from '@react-spring/web';
import classNames from 'classnames';
import { noop } from 'lodash';

import type { ModalConfigType } from '../hooks/useAnimated';
import type { Theme } from '../util/theme';
import { getClassNamesFor } from '../util/getClassNamesFor';
import { themeClassName } from '../util/theme';
import { useEscapeHandling } from '../hooks/useEscapeHandling';
import { handleOutsideClick } from '../util/handleOutsideClick';

export type PropsType = Readonly<{
  children: React.ReactElement;
  moduleClassName?: string;
  noMouseClose?: boolean;
  onClose: () => unknown;
  onEscape?: () => unknown;
  onTopOfEverything?: boolean;
  overlayStyles?: SpringValues<ModalConfigType>;
  theme?: Theme;
  useFocusTrap?: boolean;
}>;

export const ModalHost = React.memo(
  ({
    children,
    moduleClassName,
    noMouseClose,
    onClose,
    onEscape,
    onTopOfEverything,
    overlayStyles,
    theme,
    useFocusTrap = true,
  }: PropsType) => {
    const [root, setRoot] = React.useState<HTMLElement | null>(null);
    const containerRef = React.useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      setRoot(div);

      return () => {
        document.body.removeChild(div);
        setRoot(null);
      };
    }, []);

    useEscapeHandling(onEscape || onClose);
    useEffect(() => {
      if (noMouseClose) {
        return noop;
      }
      return handleOutsideClick(
        () => {
          onClose();
          return true;
        },
        { containerElements: [containerRef] }
      );
    }, [noMouseClose, onClose]);

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

                  const titleBar = document.querySelector(
                    '.TitleBarContainer__title'
                  );
                  if (titleBar?.contains(target)) {
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
  }
);
