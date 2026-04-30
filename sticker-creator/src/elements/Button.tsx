// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type ButtonHTMLAttributes,
  type RefObject,
  type PropsWithChildren,
  type JSX,
} from 'react';
import classnames from 'classnames';

import styles from './Button.module.scss';

export type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  pill?: boolean;
  primary?: boolean;
  buttonRef?: RefObject<HTMLButtonElement>;
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
}: PropsWithChildren<Props>): JSX.Element {
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
