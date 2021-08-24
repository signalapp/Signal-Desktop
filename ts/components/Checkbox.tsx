// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { getClassNamesFor } from '../util/getClassNamesFor';

export type PropsType = {
  checked?: boolean;
  description?: string;
  disabled?: boolean;
  label: string;
  moduleClassName?: string;
  name: string;
  onChange: (value: boolean) => unknown;
};

export const Checkbox = ({
  checked,
  description,
  disabled,
  label,
  moduleClassName,
  name,
  onChange,
}: PropsType): JSX.Element => {
  const getClassName = getClassNamesFor('Checkbox', moduleClassName);
  return (
    <div className={getClassName('')}>
      <div className={getClassName('__container')}>
        <div className={getClassName('__checkbox')}>
          <input
            checked={Boolean(checked)}
            disabled={disabled}
            name={name}
            onChange={ev => onChange(ev.target.checked)}
            type="checkbox"
          />
        </div>
        <div>
          <label htmlFor={name}>{label}</label>
          <div className={getClassName('__description')}>{description}</div>
        </div>
      </div>
    </div>
  );
};
