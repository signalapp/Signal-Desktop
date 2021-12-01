// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import React from 'react';
import classNames from 'classnames';

import type { Theme } from '../util/theme';
import { assert } from '../util/assert';
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
  muted = 'muted',
  photo = 'photo',
  search = 'search',
  text = 'text',
  unmuted = 'unmuted',
  video = 'video',
}

type PropsType = {
  className?: string;
  disabled?: boolean;
  icon?: ButtonIconType;
  size?: ButtonSize;
  style?: CSSProperties;
  tabIndex?: number;
  theme?: Theme;
  variant?: ButtonVariant;
} & (
  | {
      onClick: MouseEventHandler<HTMLButtonElement>;
    }
  | {
      type: 'submit';
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
  (props, ref) => {
    const {
      children,
      className,
      disabled = false,
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

    let onClick: undefined | MouseEventHandler<HTMLButtonElement>;
    let type: 'button' | 'submit';
    if ('onClick' in props) {
      ({ onClick } = props);
      type = 'button';
    } else {
      onClick = undefined;
      ({ type } = props);
    }

    const sizeClassName = SIZE_CLASS_NAMES.get(size);
    assert(sizeClassName, '<Button> size not found');

    const variantClassName = VARIANT_CLASS_NAMES.get(variant);
    assert(variantClassName, '<Button> variant not found');

    const buttonElement = (
      <button
        aria-label={ariaLabel}
        className={classNames(
          'module-Button',
          sizeClassName,
          variantClassName,
          icon && `module-Button--icon--${icon}`,
          className
        )}
        disabled={disabled}
        onClick={onClick}
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
