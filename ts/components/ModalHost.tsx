// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
import FocusTrap from 'focus-trap-react';
import type { SpringValues } from '@react-spring/web';
import { animated } from '@react-spring/web';

import type { ModalConfigType } from '../hooks/useAnimated';
import type { Theme } from '../util/theme';
import { themeClassName } from '../util/theme';
import { useEscapeHandling } from '../hooks/useEscapeHandling';

export type PropsType = {
  readonly children: React.ReactElement;
  readonly noMouseClose?: boolean;
  readonly onClose: () => unknown;
  readonly onEscape?: () => unknown;
  readonly overlayStyles?: SpringValues<ModalConfigType>;
  readonly theme?: Theme;
};

export const ModalHost = React.memo(
  ({
    children,
    noMouseClose,
    onClose,
    onEscape,
    theme,
    overlayStyles,
  }: PropsType) => {
    const [root, setRoot] = React.useState<HTMLElement | null>(null);
    const [isMouseDown, setIsMouseDown] = React.useState(false);

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

    // This makes it easier to write dialogs to be hosted here; they won't have to worry
    //   as much about preventing propagation of mouse events.
    const handleMouseDown = React.useCallback(
      (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
          setIsMouseDown(true);
        }
      },
      [setIsMouseDown]
    );
    const handleMouseUp = React.useCallback(
      (e: React.MouseEvent) => {
        setIsMouseDown(false);

        if (e.target === e.currentTarget && isMouseDown) {
          onClose();
        }
      },
      [onClose, isMouseDown, setIsMouseDown]
    );

    return root
      ? createPortal(
          <FocusTrap
            focusTrapOptions={{
              // This is alright because the overlay covers the entire screen
              allowOutsideClick: false,
            }}
          >
            <div>
              <animated.div
                role="presentation"
                className={classNames(
                  'module-modal-host__overlay',
                  theme ? themeClassName(theme) : undefined
                )}
                onMouseDown={noMouseClose ? undefined : handleMouseDown}
                onMouseUp={noMouseClose ? undefined : handleMouseUp}
                style={overlayStyles}
              />
              <div className="module-modal-host__container">{children}</div>
            </div>
          </FocusTrap>,
          root
        )
      : null;
  }
);
