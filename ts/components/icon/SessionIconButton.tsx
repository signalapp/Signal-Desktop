import classNames from 'classnames';
import _ from 'lodash';
import { KeyboardEvent, MouseEvent, ReactNode, forwardRef, memo } from 'react';
import styled from 'styled-components';
import { SessionIcon, SessionIconProps } from './SessionIcon';

export type SessionIconButtonProps = SessionIconProps & {
  onClick?: (e?: MouseEvent<HTMLButtonElement>) => void;
  isSelected?: boolean;
  isHidden?: boolean;
  margin?: string;
  padding?: string;
  dataTestIdIcon?: string;
  id?: string;
  title?: string;
  ariaLabel?: string;
  tabIndex?: number;
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
};

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

  ${props => props.disabled && 'cursor: not-allowed;'}

  &:hover svg path {
    ${props => !props.disabled && !props.color && 'fill: var(--button-icon-stroke-hover-color);'}
  }
`;

// eslint-disable-next-line react/display-name
const SessionIconButtonInner = forwardRef<HTMLButtonElement, SessionIconButtonProps>(
  (props, ref) => {
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
      padding,
      id,
      ariaLabel,
      title,
      dataTestId,
      dataTestIdIcon,
      style,
      tabIndex,
      className,
      children,
      disabled,
    } = props;
    const clickHandler = (e: MouseEvent<HTMLButtonElement>) => {
      if (!disabled && props.onClick) {
        e.stopPropagation();
        props.onClick(e);
      }
    };
    const keyPressHandler = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.currentTarget.tabIndex > -1 && e.key === 'Enter' && !disabled && props.onClick) {
        e.stopPropagation();
        props.onClick();
      }
    };

    return (
      <StyledSessionIconButton
        color={iconColor}
        isSelected={isSelected}
        className={classNames('session-icon-button', iconSize, className)}
        ref={ref}
        id={id}
        title={title}
        aria-label={ariaLabel}
        onClick={clickHandler}
        style={{
          ...style,
          display: style?.display ? style.display : isHidden ? 'none' : 'flex',
          margin: margin || '',
          padding: padding || '',
        }}
        tabIndex={tabIndex}
        onKeyDown={keyPressHandler}
        disabled={disabled}
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
  }
);

export const SessionIconButton = memo(SessionIconButtonInner, _.isEqual);
