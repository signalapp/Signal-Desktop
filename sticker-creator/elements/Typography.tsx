// Copyright 2019 Signal Messenger, LLC
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

export const H1 = React.memo(function H1Inner({
  children,
  className,
  ...rest
}: Props & HeadingProps) {
  return (
    <h1 className={classnames(styles.h1, className)} {...rest}>
      {children}
    </h1>
  );
});

export const H2 = React.memo(function H2Inner({
  children,
  className,
  ...rest
}: Props & HeadingProps) {
  return (
    <h2 className={classnames(styles.h2, className)} {...rest}>
      {children}
    </h2>
  );
});

export const Text = React.memo(function TextInner({
  children,
  className,
  center,
  secondary,
  ...rest
}: Props & ParagraphProps) {
  return (
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
  );
});

export const Inline = React.memo(function InlineInner({
  children,
  className,
  ...rest
}: Props & SpanProps) {
  return (
    <span className={classnames(styles.text, className)} {...rest}>
      {children}
    </span>
  );
});
