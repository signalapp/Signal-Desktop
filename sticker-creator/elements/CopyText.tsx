// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import copy from 'copy-text-to-clipboard';
import * as styles from './CopyText.scss';
import { Button } from './Button';
import { useI18n } from '../util/i18n';

export type Props = {
  value: string;
  label: string;
  onCopy?: () => unknown;
};

export const CopyText: React.ComponentType<Props> = React.memo(
  ({ label, onCopy, value }) => {
    const i18n = useI18n();
    const handleClick = React.useCallback(() => {
      copy(value);
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
