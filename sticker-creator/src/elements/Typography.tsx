// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type ReactNode, type HTMLAttributes, memo } from 'react';
import classnames from 'classnames';

import styles from './Typography.module.scss';

export type Props = {
  children: ReactNode;
};

export type HeadingProps = HTMLAttributes<HTMLHeadingElement>;
export type ParagraphProps = HTMLAttributes<HTMLParagraphElement> & {
  center?: boolean;
  wide?: boolean;
  secondary?: boolean;
};
export type SpanProps = HTMLAttributes<HTMLSpanElement>;

export const H1 = memo(function H1Inner({
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

export const H2 = memo(function H2Inner({
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

export const Text = memo(function TextInner({
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

export const Inline = memo(function InlineInner({
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
