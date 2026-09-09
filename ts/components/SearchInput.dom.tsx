// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ChangeEvent,
  FocusEventHandler,
  KeyboardEvent,
  ReactNode,
} from 'react';
import { forwardRef, useCallback } from 'react';
import classNames from 'classnames';
import type { LocalizerType } from '../types/Util.std.ts';
import { getClassNamesFor } from '../util/getClassNamesFor.std.ts';
import { mergeProps, useFocusRing } from 'react-aria';

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
  noMargin?: boolean;
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
      noMargin,
    },
    ref
  ) {
    const getClassName = getClassNamesFor(BASE_CLASS_NAME, moduleClassName);

    const { isFocusVisible, focusProps } = useFocusRing({
      within: true,
      isTextInput: true,
    });

    const handleKeydown = useCallback(
      (event: KeyboardEvent<HTMLInputElement>) => {
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
      },
      [onKeyDown, onClear]
    );

    return (
      <div
        className={classNames(
          getClassName('__container'),
          noMargin && getClassName('__container--noMargin')
        )}
        data-supertab
      >
        {hasSearchIcon && <i className={getClassName('__icon')} />}
        {children}
        <input
          aria-label={label || i18n('icu:search')}
          className={classNames(
            getClassName('__input'),
            value && getClassName('__input--with-text'),
            children != null && getClassName('__input--with-children')
          )}
          dir="auto"
          disabled={disabled}
          placeholder={placeholder}
          ref={ref}
          type="text"
          value={value}
          data-focus-visible={isFocusVisible}
          {...mergeProps(focusProps, {
            onBlur,
            onChange,
            onKeyDown: handleKeydown,
          })}
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
