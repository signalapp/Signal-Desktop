import React from 'react';

interface Props {
  count?: number;
  // Size in px
  size?: number;
  onClick?: any;
}

export class SessionNotificationCount extends React.Component<Props> {
  public static defaultProps = {
    size: 20,
  };

  constructor(props: any) {
    super(props);
  }

  public render() {
    const { count, size, onClick } = this.props;

    const MAX_SINGLE_DIGIT = 9;
    const overflow = count > MAX_SINGLE_DIGIT;
    const countElement: JSX.Element = overflow
      ? <>{MAX_SINGLE_DIGIT}<sup>+</sup></>
      : <>{count}</>;

    const bubbleStyle = {
      width: `${size}px`,
      height: `${size}px`,
    };

    const countStyle = {
      marginTop: overflow ? '-4px' : '0px',
      marginLeft: overflow ? '2px' : '0px',
    };
    
    const shouldRender = typeof count === 'number' && count > 0;

    return (
      <>
      {shouldRender && (
        <div
          className="notification-count"
          onClick={onClick}
          style={bubbleStyle}
          role="button"
        >
          <span style={countStyle}>
            {countElement}
          </span>
        </div>
        )}
      </>
    );
  }
}
