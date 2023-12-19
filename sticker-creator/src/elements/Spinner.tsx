// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import styles from './Spinner.module.scss';

export type Props = Readonly<{
  size: number;
}>;

export function Spinner({ size }: Props): JSX.Element {
  return (
    <svg width={size} height={size} className={styles.spinner}>
      <path d="M52.36 14.185A27.872 27.872 0 0156 28c0 15.464-12.536 28-28 28v-2c14.36 0 26-11.64 26-26 0-4.66-1.226-9.033-3.372-12.815l1.732-1z" />
    </svg>
  );
}
