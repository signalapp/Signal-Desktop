// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { MouseEventHandler, ReactNode } from 'react';
import classNames from 'classnames';

import { assert } from '../util/assert';

export enum ButtonVariant {
  Primary,
  Secondary,
  Destructive,
}

type PropsType = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  variant?: ButtonVariant;
};

const VARIANT_CLASS_NAMES = new Map<ButtonVariant, string>([
  [ButtonVariant.Primary, 'module-Button--primary'],
  [ButtonVariant.Secondary, 'module-Button--secondary'],
  [ButtonVariant.Destructive, 'module-Button--destructive'],
]);

export const Button = React.forwardRef<HTMLButtonElement, PropsType>(
  (
    {
      children,
      className,
      disabled = false,
      onClick,
      variant = ButtonVariant.Primary,
    },
    ref
  ) => {
    const variantClassName = VARIANT_CLASS_NAMES.get(variant);
    assert(variantClassName, '<Button> variant not found');

    return (
      <button
        className={classNames('module-Button', variantClassName, className)}
        disabled={disabled}
        onClick={onClick}
        ref={ref}
        type="button"
      >
        {children}
      </button>
    );
  }
);
