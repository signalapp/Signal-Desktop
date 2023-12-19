// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classnames from 'classnames';

import styles from './Button.module.scss';

export type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pill?: boolean;
  primary?: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement>;
};

const getClassName = ({ primary, pill }: Props) => {
  if (pill && primary) {
    return styles.pillPrimary;
  }

  if (pill) {
    return styles.pill;
  }

  if (primary) {
    return styles.primary;
  }

  return styles.base;
};

export function Button({
  className,
  children,
  primary,
  ...otherProps
}: React.PropsWithChildren<Props>): JSX.Element {
  return (
    <button
      type="button"
      className={classnames(
        getClassName({ primary, ...otherProps }),
        className
      )}
      {...otherProps}
    >
      {children}
    </button>
  );
}
