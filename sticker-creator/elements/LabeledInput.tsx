// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as styles from './LabeledInput.scss';
import { Inline } from './Typography';

export type Props = {
  children: React.ReactNode;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => unknown;
};

export const LabeledInput = React.memo(
  ({ children, value, placeholder, onChange }: Props) => {
    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (onChange !== undefined) {
          onChange(e.currentTarget.value);
        }
      },
      [onChange]
    );

    return (
      <label className={styles.container}>
        <Inline className={styles.label}>{children}</Inline>
        <input
          type="text"
          className={styles.input}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
        />
      </label>
    );
  }
);
