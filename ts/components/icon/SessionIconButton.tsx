import React from 'react';
import classNames from 'classnames';
import { SessionIcon, SessionIconProps } from '../icon';
import _ from 'lodash';
import { SessionNotificationCount } from './SessionNotificationCount';

interface SProps extends SessionIconProps {
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  notificationCount?: number;
  isSelected?: boolean;
  isHidden?: boolean;
  margin?: string;
  dataTestId?: string;
  id?: string;
}

const SessionIconButtonInner = React.forwardRef<HTMLDivElement, SProps>((props, ref) => {
  const {
    iconType,
    iconSize,
    iconColor,
    iconRotation,
    isSelected,
    notificationCount,
    glowDuration,
    glowStartDelay,
    noScale,
    isHidden,
    backgroundColor,
    borderRadius,
    iconPadding,
    margin,
    id,
    dataTestId,
  } = props;
  const clickHandler = (e: React.MouseEvent<HTMLDivElement>) => {
    if (props.onClick) {
      e.stopPropagation();
      props.onClick(e);
    }
  };

  return (
    <div
      className={classNames('session-icon-button', iconSize, isSelected ? 'no-opacity' : '')}
      role="button"
      ref={ref}
      id={id}
      onClick={clickHandler}
      style={{ display: isHidden ? 'none' : 'flex', margin: margin ? margin : '' }}
      data-testid={dataTestId}
    >
      <SessionIcon
        iconType={iconType}
        iconSize={iconSize}
        iconColor={iconColor}
        iconRotation={iconRotation}
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
});

export const SessionIconButton = React.memo(SessionIconButtonInner, _.isEqual);
