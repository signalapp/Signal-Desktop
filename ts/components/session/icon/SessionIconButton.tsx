import React from 'react';
import classNames from 'classnames';
import { Props, SessionIcon } from '../icon';

import { SessionNotificationCount } from '../SessionNotificationCount';

interface SProps extends Props {
  onClick?: any;
  notificationCount?: number;
  isSelected: boolean;
}

export class SessionIconButton extends React.PureComponent<SProps> {
  public static readonly extendedDefaults = {
    notificationCount: undefined,
    isSelected: false,
  };
  public static readonly defaultProps = {
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

    const { notificationCount } = this.props;

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
        <SessionNotificationCount count={notificationCount} />
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
