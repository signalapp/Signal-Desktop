// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, type JSX, type ChangeEvent } from 'react';
import classNames from 'classnames';

export enum Variant {
  Normal = 'Normal',
  Small = 'Small',
}

export type Props = {
  id?: string;
  variant?: Variant;
  checked?: boolean;
  disabled?: boolean;
  isRadio?: boolean;
  name?: string;
  /** @deprecated */
  className?: string;
  onChange?: (value: boolean) => unknown;
  onClick?: () => unknown;
};

/**
 * A fancy checkbox
 *
 * It's only the checkbox, it does NOT produce a label.
 * It is a controlled component, you must provide a value and
 * update it yourself onClick/onChange.
 */
export function CircleCheckbox({
  id,
  variant = Variant.Normal,
  checked,
  disabled,
  isRadio,
  className,
  name,
  onChange,
  onClick,
}: Props): JSX.Element {
  const onChangeWrapped = useCallback(
    (ev: ChangeEvent<HTMLInputElement>) => {
      onChange?.(ev.target.checked);
    },
    [onChange]
  );

  return (
    <div
      className={classNames(
        'CircleCheckbox__checkbox',
        variant === Variant.Small && 'CircleCheckbox__checkbox--small',
        className
      )}
    >
      <input
        checked={Boolean(checked)}
        disabled={disabled}
        aria-disabled={disabled}
        id={id}
        name={name}
        onChange={onChangeWrapped}
        onClick={onClick}
        type={isRadio ? 'radio' : 'checkbox'}
      />
    </div>
  );
}
