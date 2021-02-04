// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as styles from './LabeledCheckbox.scss';
import { Inline } from './Typography';

export type Props = {
  children: React.ReactNode;
  value?: boolean;
  onChange?: (value: boolean) => unknown;
};

const checkSvg = (
  <svg viewBox="0 0 16 16" width="16px" height="16px">
    <path d="M7 11.5c-.2 0-.4-.1-.5-.2L3.3 8.1 4.4 7 7 9.7l4.6-4.6 1.1 1.1-5.2 5.2c-.1 0-.3.1-.5.1z" />
  </svg>
);

export const LabeledCheckbox = React.memo(
  ({ children, value, onChange }: Props) => {
    const handleChange = React.useCallback(() => {
      if (onChange !== undefined) {
        onChange(!value);
      }
    }, [onChange, value]);

    const className = value ? styles.checkboxChecked : styles.checkbox;

    return (
      <label className={styles.base}>
        <input
          type="checkbox"
          className={styles.input}
          checked={value}
          aria-checked={value}
          onChange={handleChange}
        />
        <span className={className}>{value ? checkSvg : null}</span>
        <Inline className={styles.label}>{children}</Inline>
      </label>
    );
  }
);
