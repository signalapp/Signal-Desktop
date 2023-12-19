// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import styles from './CopyText.module.scss';
import { Button } from './Button';
import { useI18n } from '../contexts/I18n';

export type Props = {
  value: string;
  label: string;
  onCopy?: () => unknown;
};

export const CopyText: React.ComponentType<Props> = React.memo(
  function CopyTextInner({ label, onCopy, value }) {
    const i18n = useI18n();
    const handleClick = React.useCallback(() => {
      navigator.clipboard.writeText(value);
      if (onCopy) {
        onCopy();
      }
    }, [onCopy, value]);

    return (
      <div className={styles.container}>
        <input
          type="text"
          className={styles.input}
          value={value}
          aria-label={label}
          readOnly
        />
        <Button onClick={handleClick}>
          {i18n('StickerCreator--CopyText--button')}
        </Button>
      </div>
    );
  }
);
