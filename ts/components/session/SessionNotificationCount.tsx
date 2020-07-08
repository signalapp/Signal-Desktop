import React from 'react';
import classNames from 'classnames';

export enum NotificationCountSize {
  // Size in px
  ON_ICON = 20,
  ON_HEADER = 24,
}

interface Props {
  count?: number;
  size: number;
  onClick?: any;
}

export class SessionNotificationCount extends React.Component<Props> {
  public static defaultProps = {
    size: NotificationCountSize.ON_ICON,
  };

  constructor(props: any) {
    super(props);
  }

  public render() {
    const { count, size, onClick } = this.props;

    const hasHover = !!onClick;

    const MAX_SINGLE_DIGIT = 9;
    const overflow = typeof count === 'number' && count > MAX_SINGLE_DIGIT;

    const bubbleStyle = {
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${size}px`,
    };

    const fontSize = overflow ? '0.5em' : '0.6em';

    const countStyle = {
      fontSize,
      marginTop: overflow ? '0.35em' : '0em',
      marginLeft: overflow ? '-0.45em' : '0em',
    };

    const countElement: JSX.Element = overflow ? (
      <>
        {MAX_SINGLE_DIGIT}
        <sup>+</sup>
      </>
    ) : (
      <>{count}</>
    );

    const shouldRender = typeof count === 'number' && count > 0;

    return (
      <>
        {shouldRender && (
          <div
            className={classNames('notification-count', hasHover && 'hover')}
            onClick={onClick}
            style={bubbleStyle}
            role="button"
          >
            <div style={countStyle}>{countElement}</div>
          </div>
        )}
      </>
    );
  }
}
