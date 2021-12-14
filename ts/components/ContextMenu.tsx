// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { KeyboardEvent } from 'react';
import React, { useCallback, useEffect, useState } from 'react';
import classNames from 'classnames';
import { usePopper } from 'react-popper';
import { noop } from 'lodash';

import type { Theme } from '../util/theme';
import type { LocalizerType } from '../types/Util';
import { themeClassName } from '../util/theme';

type OptionType<T> = {
  readonly icon?: string;
  readonly label: string;
  readonly description?: string;
  readonly value: T;
};

export type PropsType<T> = {
  readonly buttonClassName?: string;
  readonly i18n: LocalizerType;
  readonly menuOptions: ReadonlyArray<OptionType<T>>;
  readonly onChange: (value: T) => unknown;
  readonly theme?: Theme;
  readonly title?: string;
  readonly value: T;
};

export function ContextMenu<T>({
  buttonClassName,
  i18n,
  menuOptions,
  onChange,
  theme,
  title,
  value,
}: PropsType<T>): JSX.Element {
  const [menuShowing, setMenuShowing] = useState<boolean>(false);
  const [focusedIndex, setFocusedIndex] = useState<number | undefined>(
    undefined
  );

  // We use regular MouseEvent below, and this one uses React.MouseEvent
  const handleClick = (ev: KeyboardEvent | React.MouseEvent) => {
    setMenuShowing(true);
    ev.stopPropagation();
    ev.preventDefault();
  };

  const handleKeyDown = (ev: KeyboardEvent) => {
    if (!menuShowing) {
      if (ev.key === 'Enter') {
        setFocusedIndex(0);
      }
      return;
    }

    if (ev.key === 'ArrowDown') {
      const currFocusedIndex = focusedIndex || 0;
      const nextFocusedIndex =
        currFocusedIndex >= menuOptions.length - 1 ? 0 : currFocusedIndex + 1;
      setFocusedIndex(nextFocusedIndex);
      ev.stopPropagation();
      ev.preventDefault();
    }

    if (ev.key === 'ArrowUp') {
      const currFocusedIndex = focusedIndex || 0;
      const nextFocusedIndex =
        currFocusedIndex === 0 ? menuOptions.length - 1 : currFocusedIndex - 1;
      setFocusedIndex(nextFocusedIndex);
      ev.stopPropagation();
      ev.preventDefault();
    }

    if (ev.key === 'Enter') {
      if (focusedIndex !== undefined) {
        onChange(menuOptions[focusedIndex].value);
      }
      setMenuShowing(false);
      ev.stopPropagation();
      ev.preventDefault();
    }
  };

  const handleClose = useCallback(() => {
    setMenuShowing(false);
    setFocusedIndex(undefined);
  }, [setMenuShowing]);

  const [referenceElement, setReferenceElement] =
    useState<HTMLButtonElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(
    null
  );
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'top-start',
    strategy: 'fixed',
  });

  useEffect(() => {
    if (!menuShowing) {
      return noop;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!referenceElement?.contains(event.target as Node)) {
        handleClose();
        event.stopPropagation();
        event.preventDefault();
      }
    };
    document.addEventListener('click', handleOutsideClick);

    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [menuShowing, handleClose, referenceElement]);

  return (
    <div className={theme ? themeClassName(theme) : undefined}>
      <button
        aria-label={i18n('ContextMenu--button')}
        className={classNames(buttonClassName, {
          ContextMenu__button: true,
          'ContextMenu__button--active': menuShowing,
        })}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        ref={setReferenceElement}
        type="button"
      />
      {menuShowing && (
        <div
          className="ContextMenu__popper"
          ref={setPopperElement}
          style={styles.popper}
          {...attributes.popper}
        >
          {title && <div className="ContextMenu__title">{title}</div>}
          {menuOptions.map((option, index) => (
            <button
              aria-label={option.label}
              className={classNames({
                ContextMenu__option: true,
                'ContextMenu__option--focused': focusedIndex === index,
              })}
              key={option.label}
              type="button"
              onClick={() => {
                onChange(option.value);
                setMenuShowing(false);
              }}
            >
              <div className="ContextMenu__option--container">
                {option.icon && (
                  <div
                    className={classNames(
                      'ContextMenu__option--icon',
                      option.icon
                    )}
                  />
                )}
                <div>
                  <div className="ContextMenu__option--title">
                    {option.label}
                  </div>
                  {option.description && (
                    <div className="ContextMenu__option--description">
                      {option.description}
                    </div>
                  )}
                </div>
              </div>
              {value === option.value ? (
                <div className="ContextMenu__option--selected" />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
