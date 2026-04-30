// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type HTMLAttributes, memo } from 'react';
import classnames from 'classnames';

import styles from './ProgressBar.module.scss';

export type Props = Pick<HTMLAttributes<HTMLDivElement>, 'className'> & {
  readonly count: number;
  readonly total: number;
};

export const ProgressBar = memo(function ProgressBarInner({
  className,
  count,
  total,
}: Props) {
  return (
    <div className={classnames(styles.base, className)}>
      <div
        className={styles.bar}
        style={{ width: `${Math.floor((count / total) * 100)}%` }}
      />
    </div>
  );
});
