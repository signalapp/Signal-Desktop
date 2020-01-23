import * as React from 'react';
import * as classnames from 'classnames';
import * as styles from './Button.scss';

export type Props = React.HTMLProps<HTMLButtonElement> & {
  className?: string;
  pill?: boolean;
  primary?: boolean;
  children: React.ReactNode;
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

export const Button = (props: Props) => {
  const { className, pill, primary, children, ...otherProps } = props;

  return (
    <button
      className={classnames(getClassName(props), className)}
      {...otherProps}
    >
      {children}
    </button>
  );
};
