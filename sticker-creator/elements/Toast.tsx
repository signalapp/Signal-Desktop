// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import * as styles from './Toast.scss';

export type Props = React.HTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

export const Toast = React.memo(({ children, className, ...rest }: Props) => (
  <button
    type="button"
    className={classNames(styles.base, className)}
    {...rest}
  >
    {children}
  </button>
));
