// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classnames from 'classnames';

import * as styles from './Typography.scss';

export type Props = {
  children: React.ReactNode;
};

export type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>;
export type ParagraphProps = React.HTMLAttributes<HTMLParagraphElement> & {
  center?: boolean;
  wide?: boolean;
  secondary?: boolean;
};
export type SpanProps = React.HTMLAttributes<HTMLSpanElement>;

export const H1 = React.memo(
  ({ children, className, ...rest }: Props & HeadingProps) => (
    <h1 className={classnames(styles.h1, className)} {...rest}>
      {children}
    </h1>
  )
);

export const H2 = React.memo(
  ({ children, className, ...rest }: Props & HeadingProps) => (
    <h2 className={classnames(styles.h2, className)} {...rest}>
      {children}
    </h2>
  )
);

export const Text = React.memo(
  ({
    children,
    className,
    center,
    secondary,
    ...rest
  }: Props & ParagraphProps) => (
    <p
      className={classnames(
        center ? styles.textCenter : styles.text,
        secondary ? styles.secondary : null,
        className
      )}
      {...rest}
    >
      {children}
    </p>
  )
);

export const Inline = React.memo(
  ({ children, className, ...rest }: Props & SpanProps) => (
    <span className={classnames(styles.text, className)} {...rest}>
      {children}
    </span>
  )
);
