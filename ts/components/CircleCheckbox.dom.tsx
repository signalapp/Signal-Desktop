// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import classNames from 'classnames';

import { getClassNamesFor } from '../util/getClassNamesFor.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';

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
  moduleClassName?: string;
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
  moduleClassName,
  name,
  onChange,
  onClick,
}: Props): JSX.Element {
  const getClassName = getClassNamesFor('CircleCheckbox', moduleClassName);

  let variantModifier: string;
  if (variant === Variant.Normal) {
    variantModifier = getClassName('__checkbox--normal');
  } else if (variant === Variant.Small) {
    variantModifier = getClassName('__checkbox--small');
  } else {
    throw missingCaseError(variant);
  }

  const onChangeWrapped = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(ev.target.checked);
    },
    [onChange]
  );

  return (
    <div className={classNames(getClassName('__checkbox'), variantModifier)}>
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
