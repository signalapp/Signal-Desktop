// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { createPortal } from 'react-dom';

export type PropsType = {
  readonly onClose: () => unknown;
  readonly children: React.ReactElement;
};

export const ModalHost = React.memo(({ onClose, children }: PropsType) => {
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
          className="module-modal-host__overlay"
          onClick={handleCancel}
        >
          {children}
        </div>,
        root
      )
    : null;
});
