// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';
import { v4 as uuid } from 'uuid';

import { getClassNamesFor } from '../util/getClassNamesFor';

export type PropsType = {
  checked?: boolean;
  description?: string;
  disabled?: boolean;
  isRadio?: boolean;
  label: string;
  moduleClassName?: string;
  name: string;
  onChange: (value: boolean) => unknown;
};

export const Checkbox = ({
  checked,
  description,
  disabled,
  isRadio,
  label,
  moduleClassName,
  name,
  onChange,
}: PropsType): JSX.Element => {
  const getClassName = getClassNamesFor('Checkbox', moduleClassName);
  const id = useMemo(() => `${name}::${uuid()}`, [name]);
  return (
    <div className={getClassName('')}>
      <div className={getClassName('__container')}>
        <div className={getClassName('__checkbox')}>
          <input
            checked={Boolean(checked)}
            disabled={disabled}
            id={id}
            name={name}
            onChange={ev => onChange(ev.target.checked)}
            type={isRadio ? 'radio' : 'checkbox'}
          />
        </div>
        <div>
          <label htmlFor={id}>{label}</label>
          <div className={getClassName('__description')}>{description}</div>
        </div>
      </div>
    </div>
  );
};
