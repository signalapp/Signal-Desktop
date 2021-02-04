// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
import {
  ConfirmationDialog,
  Props as ConfirmationDialogProps,
} from './ConfirmationDialog';
import { LocalizerType } from '../types/Util';
import { Theme, themeClassName } from '../util/theme';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly onClose: () => unknown;
  readonly theme?: Theme;
};

export type Props = OwnProps & ConfirmationDialogProps;

export const ConfirmationModal = React.memo(
  ({ i18n, onClose, theme, children, ...rest }: Props) => {
    const [root, setRoot] = React.useState<HTMLElement | null>(null);

    React.useEffect(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      setRoot(div);

      return () => {
        document.body.removeChild(div);
        setRoot(null);
      };
    }, []);

    React.useEffect(() => {
      const handler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();

          event.preventDefault();
          event.stopPropagation();
        }
      };
      document.addEventListener('keydown', handler);

      return () => {
        document.removeEventListener('keydown', handler);
      };
    }, [onClose]);

    const handleCancel = React.useCallback(
      (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      },
      [onClose]
    );

    const handleKeyCancel = React.useCallback(
      (e: React.KeyboardEvent) => {
        if (e.target === e.currentTarget && e.keyCode === 27) {
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
              'module-confirmation-dialog__overlay',
              theme ? themeClassName(theme) : undefined
            )}
            onClick={handleCancel}
            onKeyUp={handleKeyCancel}
          >
            <ConfirmationDialog i18n={i18n} {...rest} onClose={onClose}>
              {children}
            </ConfirmationDialog>
          </div>,
          root
        )
      : null;
  }
);
