// Copyright 2021 Signal Messenger, LLC
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

export type PropTypes = Readonly<{
  children?: ReactNode;
  disabled?: boolean;
  label?: string;
  hasSearchIcon?: boolean;
  i18n: LocalizerType;
  moduleClassName?: string;
  onClear?: () => unknown;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onChange: (ev: ChangeEvent<HTMLInputElement>) => unknown;
  onKeyDown?: (ev: KeyboardEvent<HTMLInputElement>) => unknown;
  placeholder: string;
  value: string;
  description?: string;
}>;

const BASE_CLASS_NAME = 'module-SearchInput';

export const SearchInput = forwardRef<HTMLInputElement, PropTypes>(
  function SearchInputInner(
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
      description,
    },
    ref
  ) {
    const getClassName = getClassNamesFor(BASE_CLASS_NAME, moduleClassName);
    return (
      <div className={getClassName('__container')} data-supertab>
        {hasSearchIcon && <i className={getClassName('__icon')} />}
        {children}
        <input
          aria-label={label || i18n('icu:search')}
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
            aria-label={i18n('icu:cancel')}
            className={getClassName('__cancel')}
            onClick={onClear}
            tabIndex={-1}
            type="button"
          />
        )}
        {description && (
          <div className={getClassName('__description')}>{description}</div>
        )}
      </div>
    );
  }
);
