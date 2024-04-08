import classNames from 'classnames';
import _ from 'lodash';
import React, { KeyboardEvent } from 'react';
import styled from 'styled-components';
import { SessionIcon, SessionIconProps } from './SessionIcon';

interface SProps extends SessionIconProps {
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  isSelected?: boolean;
  isHidden?: boolean;
  margin?: string;
  dataTestId?: string;
  dataTestIdIcon?: string;
  id?: string;
  style?: object;
  tabIndex?: number;
  children?: React.ReactNode;
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
const SessionIconButtonInner = React.forwardRef<HTMLButtonElement, SProps>((props, ref) => {
  const {
    iconType,
    iconSize,
    iconColor,
    iconRotation,
    isSelected,
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
    children,
  } = props;
  const clickHandler = (e: React.MouseEvent<HTMLButtonElement>) => {
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
      onClick={clickHandler}
      style={{ ...style, display: isHidden ? 'none' : 'flex', margin: margin || '' }}
      tabIndex={tabIndex}
      onKeyPress={keyPressHandler}
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
      {children}
    </StyledSessionIconButton>
  );
});

export const SessionIconButton = React.memo(SessionIconButtonInner, _.isEqual);
