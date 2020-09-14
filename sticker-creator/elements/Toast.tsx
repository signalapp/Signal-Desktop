import * as React from 'react';
import classNames from 'classnames';
import * as styles from './Toast.scss';

export type Props = React.HTMLProps<HTMLButtonElement> & {
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
