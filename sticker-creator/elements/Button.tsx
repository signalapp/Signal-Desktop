// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as classnames from 'classnames';
import * as styles from './Button.scss';

export type Props = React.HTMLProps<HTMLButtonElement> & {
  pill?: boolean;
  primary?: boolean;
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

export const Button: React.ComponentType<Props> = ({
  className,
  children,
  ...otherProps
}) => {
  return (
    <button
      type="button"
      className={classnames(getClassName(otherProps), className)}
      {...otherProps}
    >
      {children}
    </button>
  );
};
