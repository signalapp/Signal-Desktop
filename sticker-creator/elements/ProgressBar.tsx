import * as React from 'react';
import * as classnames from 'classnames';
import * as styles from './ProgressBar.scss';

export type Props = Pick<React.HTMLProps<HTMLDivElement>, 'className'> & {
  readonly count: number;
  readonly total: number;
};

export const ProgressBar = React.memo(({ className, count, total }: Props) => (
  <div className={classnames(styles.base, className)}>
    <div
      className={styles.bar}
      style={{ width: `${Math.floor((count / total) * 100)}%` }}
    />
  </div>
));
