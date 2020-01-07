import * as React from 'react';
import * as styles from './Toast.scss';

export type Props = React.HTMLProps<HTMLButtonElement> & {
  children: React.ReactNode;
};

export const Toast = React.memo(({ children, ...rest }: Props) => (
  <button className={styles.base} {...rest}>
    {children}
  </button>
));
