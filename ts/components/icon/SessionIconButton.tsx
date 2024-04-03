import classNames from 'classnames';
import _ from 'lodash';
import { KeyboardEvent, MouseEvent, forwardRef, memo } from 'react';
import styled from 'styled-components';
import { SessionIcon, SessionIconProps } from '.';
import { SessionNotificationCount, SessionUnreadCount } from './SessionNotificationCount';

interface SProps extends SessionIconProps {
  onClick?: (e?: MouseEvent<HTMLButtonElement>) => void;
  notificationCount?: number;
  isSelected?: boolean;
  isHidden?: boolean;
  margin?: string;
  padding?: string;
  dataTestId?: string;
  dataTestIdIcon?: string;
  id?: string;
  title?: string;
  style?: object;
  tabIndex?: number;
}

const StyledSessionIconButton = styled.button<{ color?: string; isSelected?: boolean }>`
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
const SessionIconButtonInner = forwardRef<HTMLButtonElement, SProps>((props, ref) => {
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
    padding,
    id,
    title,
    dataTestId,
    dataTestIdIcon,
    style,
    tabIndex,
    unreadCount,
  } = props;
  const clickHandler = (e: MouseEvent<HTMLButtonElement>) => {
    if (props.onClick) {
      e.stopPropagation();
      props.onClick(e);
    }
  };
  const keyPressHandler = (e: KeyboardEvent<HTMLButtonElement>) => {
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
      ref={ref}
      id={id}
      title={title}
      onClick={clickHandler}
      style={{
        ...style,
        display: isHidden ? 'none' : 'flex',
        margin: margin || '',
        padding: padding || '',
      }}
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
      {Boolean(unreadCount) && <SessionUnreadCount count={unreadCount} />}
    </StyledSessionIconButton>
  );
});

export const SessionIconButton = memo(SessionIconButtonInner, _.isEqual);
