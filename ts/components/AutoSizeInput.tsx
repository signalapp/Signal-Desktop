// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';

import { getClassNamesFor } from '../util/getClassNamesFor';

export type PropsType = Readonly<{
  disableSpellcheck?: boolean;
  disabled?: boolean;
  moduleClassName?: string;
  onChange: (newValue: string) => void;
  onEnter?: () => void;
  placeholder: string;
  value?: string;
  maxLength?: number;
}>;

export function AutoSizeInput({
  disableSpellcheck,
  disabled,
  moduleClassName,
  onChange,
  onEnter,
  placeholder,
  value = '',
  maxLength,
}: PropsType): JSX.Element {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const hiddenRef = useRef<HTMLSpanElement | null>(null);

  const [width, setWidth] = useState<undefined | number>(undefined);
  const getClassName = getClassNamesFor('AutoSizeInput', moduleClassName);

  const handleChange = useCallback(
    e => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    event => {
      if (onEnter && event.key === 'Enter') {
        onEnter();
      }
    },
    [onEnter]
  );

  useEffect(() => {
    const elem = document.createElement('div');
    document.body.appendChild(elem);

    setRoot(elem);

    return () => {
      document.body.removeChild(elem);
    };
  }, []);

  useEffect(() => {
    setWidth(hiddenRef.current?.clientWidth || undefined);
  }, [value, root]);

  return (
    <div className={getClassName('__container')}>
      <input
        type="text"
        className={getClassName('__input')}
        dir="auto"
        maxLength={maxLength}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={!disableSpellcheck}
        style={{ width }}
      />

      {root &&
        createPortal(
          <span
            ref={hiddenRef}
            className={classNames(
              getClassName('__input'),
              getClassName('__input--sizer')
            )}
          >
            {value || placeholder}
          </span>,
          root
        )}
    </div>
  );
}
