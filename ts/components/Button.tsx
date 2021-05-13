// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { MouseEventHandler, ReactNode } from 'react';
import classNames from 'classnames';

import { assert } from '../util/assert';

export enum ButtonSize {
  Medium,
  Small,
}

export enum ButtonVariant {
  Primary,
  Secondary,
  SecondaryAffirmative,
  SecondaryDestructive,
  Destructive,
}

type PropsType = {
  className?: string;
  disabled?: boolean;
  size?: ButtonSize;
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
]);

export const Button = React.forwardRef<HTMLButtonElement, PropsType>(
  (props, ref) => {
    const {
      children,
      className,
      disabled = false,
      size = ButtonSize.Medium,
      variant = ButtonVariant.Primary,
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

    return (
      <button
        aria-label={ariaLabel}
        className={classNames(
          'module-Button',
          sizeClassName,
          variantClassName,
          className
        )}
        disabled={disabled}
        onClick={onClick}
        ref={ref}
        // The `type` should either be "button" or "submit", which is effectively static.
        // eslint-disable-next-line react/button-has-type
        type={type}
      >
        {children}
      </button>
    );
  }
);
