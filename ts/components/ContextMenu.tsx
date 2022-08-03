// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { KeyboardEvent, ReactNode } from 'react';
import type { Options } from '@popperjs/core';
import FocusTrap from 'focus-trap-react';
import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { usePopper } from 'react-popper';
import { noop } from 'lodash';

import type { Theme } from '../util/theme';
import type { LocalizerType } from '../types/Util';
import { getClassNamesFor } from '../util/getClassNamesFor';
import { themeClassName } from '../util/theme';

export type ContextMenuOptionType<T> = {
  readonly description?: string;
  readonly icon?: string;
  readonly label: string;
  readonly onClick: (value?: T) => unknown;
  readonly value?: T;
};

export type PropsType<T> = {
  readonly children?: ReactNode;
  readonly i18n: LocalizerType;
  readonly menuOptions: ReadonlyArray<ContextMenuOptionType<T>>;
  readonly moduleClassName?: string;
  readonly onClick?: () => unknown;
  readonly onMenuShowingChanged?: (value: boolean) => unknown;
  readonly popperOptions?: Pick<Options, 'placement' | 'strategy'>;
  readonly theme?: Theme;
  readonly title?: string;
  readonly value?: T;
};

export function ContextMenu<T>({
  children,
  i18n,
  menuOptions,
  moduleClassName,
  onClick,
  onMenuShowingChanged,
  popperOptions,
  theme,
  title,
  value,
}: PropsType<T>): JSX.Element {
  const [isMenuShowing, setIsMenuShowing] = useState<boolean>(false);
  const [focusedIndex, setFocusedIndex] = useState<number | undefined>(
    undefined
  );
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(
    null
  );
  const [referenceElement, setReferenceElement] =
    useState<HTMLButtonElement | null>(null);

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'top-start',
    strategy: 'fixed',
    ...popperOptions,
  });

  useEffect(() => {
    if (onMenuShowingChanged) {
      onMenuShowingChanged(isMenuShowing);
    }
  }, [isMenuShowing, onMenuShowingChanged]);

  useEffect(() => {
    if (!isMenuShowing) {
      return noop;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!referenceElement?.contains(event.target as Node)) {
        setIsMenuShowing(false);
        event.stopPropagation();
        event.preventDefault();
      }
    };
    document.addEventListener('click', handleOutsideClick);

    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isMenuShowing, referenceElement]);

  const handleKeyDown = (ev: KeyboardEvent) => {
    if (!isMenuShowing) {
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
        const focusedOption = menuOptions[focusedIndex];
        focusedOption.onClick(focusedOption.value);
      }
      setIsMenuShowing(false);
      ev.stopPropagation();
      ev.preventDefault();
    }
  };

  const handleClick = (ev: KeyboardEvent | React.MouseEvent) => {
    setIsMenuShowing(true);
    ev.stopPropagation();
    ev.preventDefault();
  };

  const getClassName = getClassNamesFor('ContextMenu', moduleClassName);

  return (
    <div
      className={classNames(
        getClassName('__container'),
        theme ? themeClassName(theme) : undefined
      )}
    >
      <button
        aria-label={i18n('ContextMenu--button')}
        className={classNames(
          getClassName('__button'),
          isMenuShowing ? getClassName('__button--active') : undefined
        )}
        onClick={onClick || handleClick}
        onContextMenu={handleClick}
        onKeyDown={handleKeyDown}
        ref={setReferenceElement}
        type="button"
      >
        {children}
      </button>
      {isMenuShowing && (
        <FocusTrap
          focusTrapOptions={{
            allowOutsideClick: true,
          }}
        >
          <div className={theme ? themeClassName(theme) : undefined}>
            <div
              className={classNames(
                getClassName('__popper'),
                menuOptions.length === 1
                  ? getClassName('__popper--single-item')
                  : undefined
              )}
              ref={setPopperElement}
              style={styles.popper}
              {...attributes.popper}
            >
              {title && <div className={getClassName('__title')}>{title}</div>}
              {menuOptions.map((option, index) => (
                <button
                  aria-label={option.label}
                  className={classNames(
                    getClassName('__option'),
                    focusedIndex === index
                      ? getClassName('__option--focused')
                      : undefined
                  )}
                  key={option.label}
                  type="button"
                  onClick={() => {
                    option.onClick(option.value);
                    setIsMenuShowing(false);
                  }}
                >
                  <div className={getClassName('__option--container')}>
                    {option.icon && (
                      <div
                        className={classNames(
                          getClassName('__option--icon'),
                          option.icon
                        )}
                      />
                    )}
                    <div>
                      <div className={getClassName('__option--title')}>
                        {option.label}
                      </div>
                      {option.description && (
                        <div className={getClassName('__option--description')}>
                          {option.description}
                        </div>
                      )}
                    </div>
                  </div>
                  {typeof value !== 'undefined' &&
                  typeof option.value !== 'undefined' &&
                  value === option.value ? (
                    <div className={getClassName('__option--selected')} />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </FocusTrap>
      )}
    </div>
  );
}
