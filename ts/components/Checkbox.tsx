// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { forwardRef, useMemo } from 'react';
import { v4 as uuid } from 'uuid';

import { getClassNamesFor } from '../util/getClassNamesFor';

export type PropsType = {
  checked?: boolean;
  children?: (childrenOpts: {
    id: string;
    checkboxNode: JSX.Element;
    labelNode: JSX.Element;
    checked?: boolean;
  }) => JSX.Element;
  description?: ReactNode;
  disabled?: boolean;
  isRadio?: boolean;
  label: string;
  moduleClassName?: string;
  name: string;
  onChange: (value: boolean) => unknown;
  onClick?: () => unknown;
};

export const Checkbox = forwardRef(function CheckboxInner(
  {
    checked,
    children,
    description,
    disabled,
    isRadio,
    label,
    moduleClassName,
    name,
    onChange,
    onClick,
  }: PropsType,
  ref: React.Ref<HTMLInputElement>
): JSX.Element {
  const getClassName = getClassNamesFor('Checkbox', moduleClassName);
  const id = useMemo(() => `${name}::${uuid()}`, [name]);

  const checkboxNode = (
    <div className={getClassName('__checkbox')}>
      <input
        checked={Boolean(checked)}
        disabled={disabled}
        id={id}
        name={name}
        onChange={ev => onChange(ev.target.checked)}
        onClick={onClick}
        ref={ref}
        type={isRadio ? 'radio' : 'checkbox'}
      />
    </div>
  );

  const labelNode = (
    <div>
      <label htmlFor={id}>
        <div>{label}</div>
        <div className={getClassName('__description')}>{description}</div>
      </label>
    </div>
  );

  return (
    <div className={getClassName('')}>
      <div className={getClassName('__container')}>
        {children ? (
          children({ id, checkboxNode, labelNode, checked })
        ) : (
          <>
            {checkboxNode}
            {labelNode}
          </>
        )}
      </div>
    </div>
  );
});
