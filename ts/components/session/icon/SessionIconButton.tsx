import React from 'react';
import classNames from 'classnames';
import { SessionIcon, SessionIconProps } from '../icon';
import { SessionNotificationCount } from '../SessionNotificationCount';
import { DefaultTheme } from 'styled-components';

interface SProps extends SessionIconProps {
  onClick?: any;
  notificationCount?: number;
  isSelected?: boolean;
  theme: DefaultTheme;
}

export const SessionIconButton = (props: SProps) => {
  const {
    iconType,
    iconSize,
    iconColor,
    iconRotation,
    isSelected,
    notificationCount,
    theme,
  } = props;
  const clickHandler = (e: any) => {
    if (props.onClick) {
      e.stopPropagation();
      props.onClick();
    }
  };

  return (
    <div
      className={classNames(
        'session-icon-button',
        iconSize,
        isSelected ? 'no-opacity' : ''
      )}
      role="button"
      onClick={clickHandler}
    >
      <SessionIcon
        iconType={iconType}
        iconSize={iconSize}
        iconColor={iconColor}
        iconRotation={iconRotation}
        theme={theme}
      />
      <SessionNotificationCount count={notificationCount} />
    </div>
  );
};
