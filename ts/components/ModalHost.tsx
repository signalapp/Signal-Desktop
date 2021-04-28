// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect } from 'react';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
import { Theme, themeClassName } from '../util/theme';

export type PropsType = {
  readonly onEscape?: () => unknown;
  readonly onClose: () => unknown;
  readonly children: React.ReactElement;
  readonly theme?: Theme;
};

export const ModalHost = React.memo(
  ({ onEscape, onClose, children, theme }: PropsType) => {
    const [root, setRoot] = React.useState<HTMLElement | null>(null);

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
    const handleCancel = React.useCallback(
      (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      },
      [onClose]
    );

    return root
      ? createPortal(
          <div
            role="presentation"
            className={classNames(
              'module-modal-host__overlay',
              theme ? themeClassName(theme) : undefined
            )}
            onClick={handleCancel}
          >
            {children}
          </div>,
          root
        )
      : null;
  }
);
