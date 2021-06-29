import React from 'react';
import classNames from 'classnames';
import { SessionIcon, SessionIconProps } from '../icon';
import { SessionNotificationCount } from '../SessionNotificationCount';
import { DefaultTheme, useTheme } from 'styled-components';

interface SProps extends SessionIconProps {
  onClick?: any;
  notificationCount?: number;
  isSelected?: boolean;
  theme?: DefaultTheme;
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
    glowDuration,
    glowStartDelay,
    noScale,
  } = props;
  const clickHandler = (e: any) => {
    if (props.onClick) {
      e.stopPropagation();
      props.onClick();
    }
  };

  const themeToUSe = theme || useTheme();

  return (
    <div
      className={classNames('session-icon-button', iconSize, isSelected ? 'no-opacity' : '')}
      role="button"
      onClick={clickHandler}
    >
      <SessionIcon
        iconType={iconType}
        iconSize={iconSize}
        iconColor={iconColor}
        iconRotation={iconRotation}
        theme={themeToUSe}
        glowDuration={glowDuration}
        glowStartDelay={glowStartDelay}
        noScale={noScale}
      />
      {Boolean(notificationCount) && <SessionNotificationCount count={notificationCount} />}
    </div>
  );
};
