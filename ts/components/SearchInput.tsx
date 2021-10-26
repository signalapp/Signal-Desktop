// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChangeEvent, KeyboardEvent } from 'react';
import React, { forwardRef } from 'react';
import { getClassNamesFor } from '../util/getClassNamesFor';

export type PropTypes = {
  readonly disabled?: boolean;
  readonly moduleClassName?: string;
  readonly onChange: (ev: ChangeEvent<HTMLInputElement>) => unknown;
  readonly onKeyDown?: (ev: KeyboardEvent<HTMLInputElement>) => unknown;
  readonly placeholder: string;
  readonly value: string;
};

const BASE_CLASS_NAME = 'module-SearchInput';

export const SearchInput = forwardRef<HTMLInputElement, PropTypes>(
  (
    {
      disabled = false,
      moduleClassName,
      onChange,
      onKeyDown,
      placeholder,
      value,
    },
    ref
  ) => {
    const getClassName = getClassNamesFor(BASE_CLASS_NAME, moduleClassName);
    return (
      <div className={getClassName('__container')}>
        <i className={getClassName('__icon')} />
        <input
          className={getClassName('__input')}
          dir="auto"
          disabled={disabled}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          ref={ref}
          type="text"
          value={value}
        />
      </div>
    );
  }
);
