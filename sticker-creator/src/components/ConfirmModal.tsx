// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useInteractOutside } from '@react-aria/interactions';
import styles from './ConfirmModal.module.scss';
import type { Props } from '../elements/ConfirmDialog';
import { ConfirmDialog } from '../elements/ConfirmDialog';

export type Mode = 'removable' | 'pick-emoji' | 'add';

export function ConfirmModal(props: Props): JSX.Element {
  const { onCancel } = props;
  const ref = useRef<HTMLDivElement>(null);
  useInteractOutside({ ref, onInteractOutside: onCancel });
  return createPortal(
    <div className={styles.facade}>
      <ConfirmDialog ref={ref} {...props} />
    </div>,
    document.body
  );
}
