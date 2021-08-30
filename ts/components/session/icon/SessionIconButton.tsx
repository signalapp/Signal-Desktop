import React from 'react';
import classNames from 'classnames';
import { SessionIcon, SessionIconProps } from '../icon';
import { SessionNotificationCount } from '../SessionNotificationCount';
import { DefaultTheme, useTheme } from 'styled-components';
import _ from 'lodash';

interface SProps extends SessionIconProps {
  onClick?: any;
  notificationCount?: number;
  isSelected?: boolean;
  theme?: DefaultTheme;
  isHidden?: boolean;
}

const SessionIconButtonInner = (props: SProps) => {
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
    isHidden,
    backgroundColor,
    borderRadius,
    iconPadding,
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
      style={{ display: isHidden ? 'none' : 'flex' }}
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
        backgroundColor={backgroundColor}
        borderRadius={borderRadius}
        iconPadding={iconPadding}
      />
      {Boolean(notificationCount) && <SessionNotificationCount count={notificationCount} />}
    </div>
  );
};

export const SessionIconButton = React.memo(SessionIconButtonInner, _.isEqual);
