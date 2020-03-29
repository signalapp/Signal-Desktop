import React from 'react';
import classNames from 'classnames';

export enum NotificationCountSize {
  // Size in px
  ON_ICON = 20,
  ON_HEADER = 24,
}

interface Props {
  count: number;
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

    const fontSizeVal = overflow ? size / 2 : size / 2 + 2;
    const fontSize = `${fontSizeVal}px`;

    const bubbleStyle = {
      width: `${size}px`,
      height: `${size}px`,
    };

    const countStyle = {
      fontSize,
      marginTop: overflow ? `${size / 8}px` : '0px',
      marginLeft: overflow ? `-${size / 4}px` : '0px',
    };

    const supStyle = {
      top: `-${size * (3 / 8)}px`,
    };

    const countElement: JSX.Element = overflow ? (
      <>
        {MAX_SINGLE_DIGIT}
        <sup style={supStyle}>+</sup>
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
            <span style={countStyle}>{countElement}</span>
          </div>
        )}
      </>
    );
  }
}
