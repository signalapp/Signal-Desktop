import classNames from 'classnames';
import React, { ReactNode } from 'react';
import styled from 'styled-components';

export enum SessionButtonType {
  Outline = 'outline',
  Simple = 'simple',
  Solid = 'solid',
}

export enum SessionButtonShape {
  Round = 'round',
  Square = 'square',
}

// NOTE References ts/themes/colors.tsx
export enum SessionButtonColor {
  Green = 'green',
  Blue = 'blue',
  Yellow = 'yellow',
  Pink = 'pink',
  Purple = 'purple',
  Orange = 'orange',
  Red = 'red',
  White = 'white',
  Primary = 'primary',
  Danger = 'danger',
  None = 'transparent',
}

const StyledButton = styled.button<{
  color: string | undefined;
  buttonType: SessionButtonType;
  buttonShape: SessionButtonShape;
}>`
  width: auto;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: var(--font-size-md);
  font-weight: 700;
  user-select: none;
  white-space: nowrap;
  cursor: pointer;
  transition: var(--default-duration);
  background-repeat: no-repeat;
  overflow: hidden;
  height: 34px;
  padding: 0px 18px;
  background-color: ${props =>
    props.buttonType === SessionButtonType.Solid && props.color
      ? `var(--${props.color}-color)`
      : `var(--button-${props.buttonType}-background-color)`};
  color: ${props =>
    props.color
      ? props.buttonType !== SessionButtonType.Solid
        ? `var(--${props.color}-color)`
        : 'var(--white-color)'
      : `var(--button-${props.buttonType}-text-color)`};
  ${props =>
    props.buttonType === SessionButtonType.Outline &&
    `outline: none; border: 1px solid ${
      props.color ? `var(--${props.color}-color)` : 'var(--button-outline-border-color)'
    }`};
  ${props =>
    props.buttonType === SessionButtonType.Solid &&
    'box-shadow: 0px 0px 6px var(--button-solid-shadow-color);'}
  border-radius: ${props => (props.buttonShape === SessionButtonShape.Round ? '17px' : '6px')};

  .session-icon {
    fill: var(--background-primary-color);
  }

  & > *:hover:not(svg) {
    filter: brightness(80%);
  }

  &.disabled {
    cursor: not-allowed;
    outline: none;
    ${props =>
      props.buttonType === SessionButtonType.Solid
        ? 'background-color: var(--button-solid-disabled-color)'
        : props.buttonType === SessionButtonType.Outline
          ? 'border: 1px solid var(--button-outline-disabled-color)'
          : ''};
    color: ${props =>
      props.buttonType === SessionButtonType.Solid
        ? 'var(--button-solid-text-color)'
        : `var(--button-${props.buttonType}-disabled-color)`};
  }

  &:not(.disabled) {
    &:hover {
      color: ${props => `var(--button-${props.buttonType}-text-hover-color)`};
      ${props =>
        props.buttonType &&
        `background-color: var(--button-${props.buttonType}-background-hover-color);`};
      ${props =>
        props.buttonType === SessionButtonType.Outline &&
        'outline: none; border: 1px solid var(--button-outline-border-hover-color);'};
    }
  }
`;

type Props = {
  text?: string;
  disabled?: boolean;
  buttonType: SessionButtonType;
  buttonShape: SessionButtonShape;
  buttonColor?: SessionButtonColor; // will override theme
  onClick: any;
  children?: ReactNode;
  margin?: string;
  dataTestId?: string;
};

export const SessionButton = (props: Props) => {
  const { buttonType, buttonShape, dataTestId, buttonColor, text, disabled, onClick, margin } =
    props;

  const clickHandler = (e: any) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };
  const onClickFn = disabled ? () => null : clickHandler;

  return (
    <StyledButton
      color={buttonColor}
      buttonShape={buttonShape}
      buttonType={buttonType}
      className={classNames(
        'session-button',
        buttonShape,
        buttonType,
        buttonColor ?? '',
        disabled && 'disabled'
      )}
      role="button"
      onClick={onClickFn}
      data-testid={dataTestId}
      style={{ margin }}
    >
      {props.children || text}
    </StyledButton>
  );
};

SessionButton.defaultProps = {
  disabled: false,
  buttonShape: SessionButtonShape.Round,
  buttonType: SessionButtonType.Outline,
  onClick: null,
} as Partial<Props>;
