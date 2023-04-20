// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { createPortal } from 'react-dom';
import styles from './ConfirmModal.module.scss';
import type { Props } from '../elements/ConfirmDialog';
import { ConfirmDialog } from '../elements/ConfirmDialog';

export type Mode = 'removable' | 'pick-emoji' | 'add';

export const ConfirmModal = React.memo(function ConfirmModalInner(
  props: Props & { buttonRef: React.RefObject<HTMLElement> }
) {
  const { buttonRef, onCancel } = props;
  const [popperRoot, setPopperRoot] = React.useState<HTMLDivElement>();

  // Create popper root and handle outside clicks
  React.useEffect(() => {
    const root = document.createElement('div');
    setPopperRoot(root);
    document.body.appendChild(root);
    const handleOutsideClick = ({ target }: MouseEvent) => {
      const node = target as Node;
      if (!root.contains(node) && !buttonRef.current?.contains(node)) {
        onCancel();
      }
    };
    document.addEventListener('click', handleOutsideClick);

    return () => {
      document.body.removeChild(root);
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [onCancel, buttonRef]);

  return popperRoot
    ? createPortal(
        <div className={styles.facade}>
          <ConfirmDialog {...props} />
        </div>,
        popperRoot
      )
    : null;
});
