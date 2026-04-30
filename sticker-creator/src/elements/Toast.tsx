// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type HTMLAttributes, type ReactNode, memo } from 'react';
import classNames from 'classnames';
import styles from './Toast.module.scss';

export type Props = HTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export const Toast = memo(function ToastInner({
  children,
  className,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={classNames(styles.base, className)}
      {...rest}
    >
      {children}
    </button>
  );
});
