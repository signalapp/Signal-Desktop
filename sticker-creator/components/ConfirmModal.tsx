// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { createPortal } from 'react-dom';
import * as styles from './ConfirmModal.scss';
import type { Props } from '../elements/ConfirmDialog';
import { ConfirmDialog } from '../elements/ConfirmDialog';

export type Mode = 'removable' | 'pick-emoji' | 'add';

export const ConfirmModal = React.memo((props: Props) => {
  const { onCancel } = props;
  const [popperRoot, setPopperRoot] = React.useState<HTMLDivElement>();

  // Create popper root and handle outside clicks
  React.useEffect(() => {
    const root = document.createElement('div');
    setPopperRoot(root);
    document.body.appendChild(root);
    const handleOutsideClick = ({ target }: MouseEvent) => {
      if (!root.contains(target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('click', handleOutsideClick);

    return () => {
      document.body.removeChild(root);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [onCancel]);

  return popperRoot
    ? createPortal(
        <div className={styles.facade}>
          <ConfirmDialog {...props} />
        </div>,
        popperRoot
      )
    : null;
});
