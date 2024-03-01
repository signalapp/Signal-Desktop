import classNames from 'classnames';
import _ from 'lodash';
import { KeyboardEvent, MouseEvent, forwardRef, memo } from 'react';
import styled from 'styled-components';

import { SessionIcon, SessionIconProps } from '.';
import { SessionNotificationCount } from './SessionNotificationCount';

interface SProps extends SessionIconProps {
  onClick?: (e?: MouseEvent<HTMLDivElement>) => void;
  notificationCount?: number;
  isSelected?: boolean;
  isHidden?: boolean;
  margin?: string;
  dataTestId?: string;
  dataTestIdIcon?: string;
  id?: string;
  style?: object;
  tabIndex?: number;
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

// eslint-disable-next-line react/display-name
const SessionIconButtonInner = forwardRef<HTMLDivElement, SProps>((props, ref) => {
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
    dataTestIdIcon,
    style,
    tabIndex,
  } = props;
  const clickHandler = (e: MouseEvent<HTMLDivElement>) => {
    if (props.onClick) {
      e.stopPropagation();
      props.onClick(e);
    }
  };
  const keyPressHandler = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.currentTarget.tabIndex > -1 && e.key === 'Enter' && props.onClick) {
      e.stopPropagation();
      props.onClick();
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
      style={{ ...style, display: isHidden ? 'none' : 'flex', margin: margin || '' }}
      tabIndex={tabIndex}
      onKeyDown={keyPressHandler}
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
        dataTestId={dataTestIdIcon}
      />
      {Boolean(notificationCount) && <SessionNotificationCount count={notificationCount} />}
    </StyledSessionIconButton>
  );
});

export const SessionIconButton = memo(SessionIconButtonInner, _.isEqual);
