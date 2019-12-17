import * as React from 'react';
import * as styles from './StoryRow.scss';

export type Props = {
  children: React.ReactChild;
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

export const StoryRow = (props: Props) => (
  <div className={getClassName(props)}>{props.children}</div>
);
