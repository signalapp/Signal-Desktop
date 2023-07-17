import React from 'react';
import classNames from 'classnames';
import { SessionIcon, SessionIconProps } from '../icon';
import _ from 'lodash';
import { SessionNotificationCount } from './SessionNotificationCount';
import styled from 'styled-components';

interface SProps extends SessionIconProps {
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  notificationCount?: number;
  isSelected?: boolean;
  isHidden?: boolean;
  margin?: string;
  dataTestId?: string;
  id?: string;
  style?: object;
}

const StyledSessionIconButton = styled.div<{ color?: string; isSelected?: boolean }>`
  background-color: var(--button-icon-background-color);

  svg path {
    transition: var(--default-duration);
    ${props =>
      !props.color &&
      `fill:
        ${
          props.isSelected
            ? 'var(--button-icon-stroke-selected-color)'
            : 'var(--button-icon-stroke-color)'
        };`}
  }

  &:hover svg path {
    ${props => !props.color && 'fill: var(--button-icon-stroke-hover-color);'}
  }
`;

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
    style,
  } = props;
  const clickHandler = (e: React.MouseEvent<HTMLDivElement>) => {
    if (props.onClick) {
      e.stopPropagation();
      props.onClick(e);
    }
  };

  return (
    <StyledSessionIconButton
      color={iconColor}
      isSelected={isSelected}
      className={classNames('session-icon-button', iconSize)}
      role="button"
      ref={ref}
      id={id}
      onClick={clickHandler}
      style={{ ...style, display: isHidden ? 'none' : 'flex', margin: margin ? margin : '' }}
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
        data-testid={dataTestId}
      />
      {Boolean(notificationCount) && <SessionNotificationCount count={notificationCount} />}
    </StyledSessionIconButton>
  );
});

export const SessionIconButton = React.memo(SessionIconButtonInner, _.isEqual);
