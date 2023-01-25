// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { getClassNamesFor } from '../util/getClassNamesFor';

export type Props = {
  id?: string;
  checked?: boolean;
  disabled?: boolean;
  isRadio?: boolean;
  name?: string;
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
  checked,
  disabled,
  isRadio,
  name,
  onChange,
  onClick,
}: Props): JSX.Element {
  const getClassName = getClassNamesFor('CircleCheckbox');

  return (
    <div className={getClassName('__checkbox')}>
      <input
        checked={Boolean(checked)}
        disabled={disabled}
        aria-disabled={disabled}
        id={id}
        name={name}
        onChange={onChange && (ev => onChange(ev.target.checked))}
        onClick={onClick}
        type={isRadio ? 'radio' : 'checkbox'}
      />
    </div>
  );
}
