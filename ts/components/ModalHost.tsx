// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
import { Theme, themeClassName } from '../util/theme';

export type PropsType = {
  readonly noMouseClose?: boolean;
  readonly onEscape?: () => unknown;
  readonly onClose: () => unknown;
  readonly children: React.ReactElement;
  readonly theme?: Theme;
};

export const ModalHost = React.memo(
  ({ onEscape, onClose, children, noMouseClose, theme }: PropsType) => {
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

    useEffect(() => {
      const handler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          if (onEscape) {
            onEscape();
          } else {
            onClose();
          }

          event.preventDefault();
          event.stopPropagation();
        }
      };
      document.addEventListener('keydown', handler);

      return () => {
        document.removeEventListener('keydown', handler);
      };
    }, [onEscape, onClose]);

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
          <div
            role="presentation"
            className={classNames(
              'module-modal-host__overlay',
              theme ? themeClassName(theme) : undefined
            )}
            onMouseDown={noMouseClose ? undefined : handleMouseDown}
            onMouseUp={noMouseClose ? undefined : handleMouseUp}
          >
            {children}
          </div>,
          root
        )
      : null;
  }
);
