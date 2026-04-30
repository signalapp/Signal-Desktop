// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useCallback, type ReactNode, type ChangeEvent } from 'react';
import styles from './LabeledInput.module.scss';
import { Inline } from './Typography';

export type Props = {
  children: ReactNode;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => unknown;
};

export const LabeledInput = memo(function LabeledInputInner({
  children,
  value,
  placeholder,
  onChange,
}: Props) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
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
});
