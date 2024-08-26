// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  CSSProperties,
  KeyboardEventHandler,
  MouseEventHandler,
  ReactNode,
} from 'react';
import React from 'react';
import classNames from 'classnames';

import type { Theme } from '../util/theme';
import { assertDev } from '../util/assert';
import { themeClassName } from '../util/theme';

export enum ButtonSize {
  Large,
  Medium,
  Small,
}

export enum ButtonVariant {
  Calling = 'Calling',
  Destructive = 'Destructive',
  Details = 'Details',
  Primary = 'Primary',
  Secondary = 'Secondary',
  SecondaryAffirmative = 'SecondaryAffirmative',
  SecondaryDestructive = 'SecondaryDestructive',
  SystemMessage = 'SystemMessage',
}

export enum ButtonIconType {
  audio = 'audio',
  message = 'message',
  muted = 'muted',
  search = 'search',
  unmuted = 'unmuted',
  video = 'video',
}

export type PropsType = {
  className?: string;
  disabled?: boolean;
  discouraged?: boolean;
  icon?: ButtonIconType;
  size?: ButtonSize;
  style?: CSSProperties;
  tabIndex?: number;
  theme?: Theme;
  variant?: ButtonVariant;
  'aria-disabled'?: boolean;
} & (
  | {
      onClick: MouseEventHandler<HTMLButtonElement>;
      // TODO: DESKTOP-4121
      onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
    }
  | {
      type: 'submit';
      form?: string;
    }
) &
  (
    | {
        'aria-label': string;
        children: ReactNode;
      }
    | {
        'aria-label'?: string;
        children: ReactNode;
      }
    | {
        'aria-label': string;
        children?: ReactNode;
      }
  );

const SIZE_CLASS_NAMES = new Map<ButtonSize, string>([
  [ButtonSize.Large, 'module-Button--large'],
  [ButtonSize.Medium, 'module-Button--medium'],
  [ButtonSize.Small, 'module-Button--small'],
]);

const VARIANT_CLASS_NAMES = new Map<ButtonVariant, string>([
  [ButtonVariant.Primary, 'module-Button--primary'],
  [ButtonVariant.Secondary, 'module-Button--secondary'],
  [
    ButtonVariant.SecondaryAffirmative,
    'module-Button--secondary module-Button--secondary--affirmative',
  ],
  [
    ButtonVariant.SecondaryDestructive,
    'module-Button--secondary module-Button--secondary--destructive',
  ],
  [ButtonVariant.Destructive, 'module-Button--destructive'],
  [ButtonVariant.Calling, 'module-Button--calling'],
  [ButtonVariant.SystemMessage, 'module-Button--system-message'],
  [ButtonVariant.Details, 'module-Button--details'],
]);

export const Button = React.forwardRef<HTMLButtonElement, PropsType>(
  function ButtonInner(props, ref) {
    const {
      children,
      className,
      disabled = false,
      discouraged = false,
      icon,
      style,
      tabIndex,
      theme,
      variant = ButtonVariant.Primary,
      size = variant === ButtonVariant.Details
        ? ButtonSize.Small
        : ButtonSize.Medium,
    } = props;
    const ariaLabel = props['aria-label'];
    const ariaDisabled = props['aria-disabled'];

    let onClick: undefined | MouseEventHandler<HTMLButtonElement>;
    let type: 'button' | 'submit';
    let form;
    if ('onClick' in props) {
      ({ onClick } = props);
      type = 'button';
    } else {
      onClick = undefined;
      ({ type } = props);
      ({ form } = props);
    }

    const sizeClassName = SIZE_CLASS_NAMES.get(size);
    assertDev(sizeClassName, '<Button> size not found');

    const variantClassName = VARIANT_CLASS_NAMES.get(variant);
    assertDev(variantClassName, '<Button> variant not found');

    const buttonElement = (
      <button
        aria-label={ariaLabel}
        aria-disabled={ariaDisabled}
        className={classNames(
          'module-Button',
          sizeClassName,
          variantClassName,
          discouraged ? `${variantClassName}--discouraged` : undefined,
          icon && `module-Button--icon--${icon}`,
          className,
          className && discouraged ? `${className}--discouraged` : undefined
        )}
        disabled={disabled}
        onClick={onClick}
        form={form}
        ref={ref}
        style={style}
        tabIndex={tabIndex}
        // The `type` should either be "button" or "submit", which is effectively static.
        // eslint-disable-next-line react/button-has-type
        type={type}
      >
        {children}
      </button>
    );

    if (theme) {
      return <div className={themeClassName(theme)}>{buttonElement}</div>;
    }

    return buttonElement;
  }
);
