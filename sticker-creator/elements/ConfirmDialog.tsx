// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as styles from './ConfirmDialog.scss';
import { useI18n } from '../util/i18n';

export type Props = {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly confirm: string;
  readonly onConfirm: () => unknown;
  readonly cancel?: string;
  readonly onCancel: () => unknown;
};

export const ConfirmDialog: React.ComponentType<Props> = ({
  title,
  children,
  confirm,
  cancel,
  onConfirm,
  onCancel,
}) => {
  const i18n = useI18n();
  const cancelText = cancel || i18n('StickerCreator--ConfirmDialog--cancel');

  return (
    <div className={styles.base}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.text}>{children}</p>
      <div className={styles.bottom}>
        <button type="button" className={styles.button} onClick={onCancel}>
          {cancelText}
        </button>
        <button
          type="button"
          className={styles.buttonPrimary}
          onClick={onConfirm}
        >
          {confirm}
        </button>
      </div>
    </div>
  );
};
