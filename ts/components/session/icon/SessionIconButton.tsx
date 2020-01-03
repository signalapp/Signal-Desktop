import React from 'react';
import classNames from 'classnames';

import { Props, SessionIcon } from '../icon';

interface SProps extends Props {
  onClick: any;
  notificationCount: number | undefined;
  isSelected: boolean;
}

export class SessionIconButton extends React.PureComponent<SProps> {
  public static readonly extendedDefaults = {
    onClick: () => null,
    notificationCount: undefined,
    isSelected: false,
  };
  public static readonly defaultProps = {
    ...SessionIcon.defaultProps,
    ...SessionIconButton.extendedDefaults,
  };

  constructor(props: any) {
    super(props);
    this.clickHandler = this.clickHandler.bind(this);
  }

  public render() {
    const {
      iconType,
      iconSize,
      iconColor,
      iconRotation,
      iconPadded,
      isSelected,
    } = this.props;

    let { notificationCount } = this.props;

    if (notificationCount === 0) {
      notificationCount = undefined;
    } else if (notificationCount !== undefined && notificationCount > 9) {
      notificationCount = 9;
    }

    return (
      <div
        className={classNames(
          'session-icon-button',
          iconSize,
          iconPadded ? 'padded' : '',
          isSelected ? 'no-opacity' : ''
        )}
        role="button"
        onClick={e => {
          this.clickHandler(e);
        }}
      >
        <SessionIcon
          iconType={iconType}
          iconSize={iconSize}
          iconColor={iconColor}
          iconRotation={iconRotation}
        />
        {notificationCount !== undefined && (
          <span className="notification-count">{notificationCount}</span>
        )}
      </div>
    );
  }

  private clickHandler(e: any) {
    if (this.props.onClick) {
      e.stopPropagation();
      this.props.onClick();
    }
  }
}
