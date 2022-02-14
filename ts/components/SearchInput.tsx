// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ChangeEvent,
  FocusEventHandler,
  KeyboardEvent,
  ReactNode,
} from 'react';
import React, { forwardRef } from 'react';
import classNames from 'classnames';
import type { LocalizerType } from '../types/Util';
import { getClassNamesFor } from '../util/getClassNamesFor';

export type PropTypes = {
  readonly children?: ReactNode;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly hasSearchIcon?: boolean;
  readonly i18n: LocalizerType;
  readonly moduleClassName?: string;
  readonly onClear?: () => unknown;
  readonly onBlur?: FocusEventHandler<HTMLInputElement>;
  readonly onChange: (ev: ChangeEvent<HTMLInputElement>) => unknown;
  readonly onKeyDown?: (ev: KeyboardEvent<HTMLInputElement>) => unknown;
  readonly placeholder: string;
  readonly value: string;
};

const BASE_CLASS_NAME = 'module-SearchInput';

export const SearchInput = forwardRef<HTMLInputElement, PropTypes>(
  (
    {
      children,
      disabled = false,
      hasSearchIcon = true,
      i18n,
      label,
      moduleClassName,
      onClear,
      onBlur,
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
        {hasSearchIcon && <i className={getClassName('__icon')} />}
        {children}
        <input
          aria-label={label || i18n('search')}
          className={classNames(
            getClassName('__input'),
            value && getClassName('__input--with-text'),
            children && getClassName('__input--with-children')
          )}
          dir="auto"
          disabled={disabled}
          onBlur={onBlur}
          onChange={onChange}
          onKeyDown={event => {
            const { ctrlKey, key } = event;

            // On Linux, this key combo selects all text.
            if (window.platform === 'linux' && ctrlKey && key === '/') {
              event.preventDefault();
              event.stopPropagation();
            } else if (key === 'Escape' && onClear) {
              onClear();
              event.preventDefault();
              event.stopPropagation();
            }

            onKeyDown?.(event);
          }}
          placeholder={placeholder}
          ref={ref}
          type="text"
          value={value}
        />
        {value && onClear && (
          <button
            aria-label={i18n('cancel')}
            className={getClassName('__cancel')}
            onClick={onClear}
            tabIndex={-1}
            type="button"
          />
        )}
      </div>
    );
  }
);
