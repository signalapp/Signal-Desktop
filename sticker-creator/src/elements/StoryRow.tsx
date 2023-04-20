// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import styles from './StoryRow.module.scss';

type Props = {
  left?: boolean;
  right?: boolean;
  top?: boolean;
  bottom?: boolean;
};

const getClassName = ({ left, right, top, bottom }: Props) => {
  if (left) {
    return styles.left;
  }

  if (right) {
    return styles.right;
  }

  if (top) {
    return styles.top;
  }

  if (bottom) {
    return styles.bottom;
  }

  return styles.base;
};

export function StoryRow({
  children,
  ...props
}: React.PropsWithChildren<Props>): JSX.Element {
  return <div className={getClassName(props)}>{children}</div>;
}
