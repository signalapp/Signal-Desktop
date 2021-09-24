// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { KeyboardEvent, ReactNode, useEffect } from 'react';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
import { onTimeout, removeTimeout } from '../services/timers';

export type PropsType = {
  autoDismissDisabled?: boolean;
  children: ReactNode;
  className?: string;
  disableCloseOnClick?: boolean;
  onClick?: () => unknown;
  onClose: () => unknown;
  timeout?: number;
};

export const Toast = ({
  autoDismissDisabled = false,
  children,
  className,
  disableCloseOnClick = false,
  onClick,
  onClose,
  timeout = 2000,
}: PropsType): JSX.Element | null => {
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
    if (!root || autoDismissDisabled) {
      return;
    }

    const timeoutId = onTimeout(Date.now() + timeout, onClose);

    return () => {
      if (timeoutId) {
        removeTimeout(timeoutId);
      }
    };
  }, [autoDismissDisabled, onClose, root, timeout]);

  let interactivityProps = {};
  if (onClick) {
    interactivityProps = {
      role: 'button',
      onClick() {
        onClick();
        if (!disableCloseOnClick) {
          onClose();
        }
      },
      onKeyDown(ev: KeyboardEvent<HTMLDivElement>) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          onClick();
          if (!disableCloseOnClick) {
            onClose();
          }
        }
      },
    };
  }

  return root
    ? createPortal(
        <div
          className={classNames(
            'Toast',
            onClick ? 'Toast--clickable' : null,
            className
          )}
          {...interactivityProps}
        >
          {children}
        </div>,
        root
      )
    : null;
};
