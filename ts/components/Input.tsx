// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ClipboardEvent, ReactNode } from 'react';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import classNames from 'classnames';

import * as grapheme from '../util/grapheme';
import type { LocalizerType } from '../types/Util';
import { getClassNamesFor } from '../util/getClassNamesFor';
import { useRefMerger } from '../hooks/useRefMerger';
import { byteLength } from '../Bytes';

export type PropsType = {
  autoFocus?: boolean;
  countBytes?: (value: string) => number;
  countLength?: (value: string) => number;
  disabled?: boolean;
  disableSpellcheck?: boolean;
  expandable?: boolean;
  forceTextarea?: boolean;
  hasClearButton?: boolean;
  i18n: LocalizerType;
  icon?: ReactNode;
  id?: string;
  maxByteCount?: number;
  maxLengthCount?: number;
  moduleClassName?: string;
  onChange: (value: string) => unknown;
  onBlur?: () => unknown;
  onEnter?: () => unknown;
  placeholder: string;
  value?: string;
  whenToShowRemainingCount?: number;
  whenToWarnRemainingCount?: number;
  children?: ReactNode;
};

/**
 * Some inputs must have fewer than maxLengthCount glyphs. Ideally, we'd use the
 * `maxLength` property on inputs, but that doesn't account for glyphs that are more than
 * one UTF-16 code units. For example: `'💩💩'.length === 4`.
 *
 * This component effectively implements a "max grapheme length" on an input.
 *
 * At a high level, this component handles two methods of input:
 *
 * - `onChange`. *Before* the value is changed (in `onKeyDown`), we save the value and the
 *   cursor position. Then, in `onChange`, we see if the new value is too long. If it is,
 *   we revert the value and selection. Otherwise, we fire `onChangeValue`.
 *
 * - `onPaste`. If you're pasting something that will fit, we fall back to normal browser
 *   behavior, which calls `onChange`. If you're pasting something that won't fit, it's a
 *   noop.
 */
export const Input = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  PropsType
>(function InputInner(
  {
    autoFocus,
    countBytes = byteLength,
    countLength = grapheme.count,
    disabled,
    disableSpellcheck,
    expandable,
    forceTextarea,
    hasClearButton,
    i18n,
    icon,
    id,
    maxByteCount = 0,
    maxLengthCount = 0,
    moduleClassName,
    onChange,
    onBlur,
    onEnter,
    placeholder,
    value = '',
    whenToShowRemainingCount = Infinity,
    whenToWarnRemainingCount = Infinity,
    children,
  },
  ref
) {
  const innerRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const valueOnKeydownRef = useRef<string>(value);
  const selectionStartOnKeydownRef = useRef<number>(value.length);
  const [isLarge, setIsLarge] = useState(false);
  const refMerger = useRefMerger();

  const maybeSetLarge = useCallback(() => {
    if (!expandable) {
      return;
    }

    const inputEl = innerRef.current;
    if (!inputEl) {
      return;
    }

    if (
      inputEl.scrollHeight > inputEl.clientHeight ||
      inputEl.scrollWidth > inputEl.clientWidth
    ) {
      setIsLarge(true);
    }
  }, [expandable]);

  const handleKeyDown = useCallback(
    event => {
      if (onEnter && event.key === 'Enter') {
        onEnter();
      }

      const inputEl = innerRef.current;
      if (!inputEl) {
        return;
      }

      valueOnKeydownRef.current = inputEl.value;
      selectionStartOnKeydownRef.current = inputEl.selectionStart || 0;
    },
    [onEnter]
  );

  const handleChange = useCallback(() => {
    const inputEl = innerRef.current;
    if (!inputEl) {
      return;
    }

    const newValue = inputEl.value;

    const newLengthCount = maxLengthCount ? countLength(newValue) : 0;
    const newByteCount = maxByteCount ? countBytes(newValue) : 0;

    if (newLengthCount <= maxLengthCount && newByteCount <= maxByteCount) {
      onChange(newValue);
    } else {
      inputEl.value = valueOnKeydownRef.current;
      inputEl.selectionStart = selectionStartOnKeydownRef.current;
      inputEl.selectionEnd = selectionStartOnKeydownRef.current;
    }

    maybeSetLarge();
  }, [
    countLength,
    countBytes,
    maxLengthCount,
    maxByteCount,
    maybeSetLarge,
    onChange,
  ]);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const inputEl = innerRef.current;
      if (!inputEl || !maxLengthCount || !maxByteCount) {
        return;
      }

      const selectionStart = inputEl.selectionStart || 0;
      const selectionEnd = inputEl.selectionEnd || inputEl.selectionStart || 0;
      const textBeforeSelection = value.slice(0, selectionStart);
      const textAfterSelection = value.slice(selectionEnd);

      const pastedText = event.clipboardData.getData('Text');

      const newLengthCount =
        countLength(textBeforeSelection) +
        countLength(pastedText) +
        countLength(textAfterSelection);
      const newByteCount =
        countBytes(textBeforeSelection) +
        countBytes(pastedText) +
        countBytes(textAfterSelection);

      if (newLengthCount > maxLengthCount || newByteCount > maxByteCount) {
        event.preventDefault();
      }

      maybeSetLarge();
    },
    [
      countLength,
      countBytes,
      maxLengthCount,
      maxByteCount,
      maybeSetLarge,
      value,
    ]
  );

  useEffect(() => {
    maybeSetLarge();
  }, [maybeSetLarge]);

  const lengthCount = maxLengthCount ? countLength(value) : -1;
  const getClassName = getClassNamesFor('Input', moduleClassName);

  const isTextarea = expandable || forceTextarea;

  const inputProps = {
    autoFocus,
    className: classNames(
      getClassName('__input'),
      icon && getClassName('__input--with-icon'),
      isLarge && getClassName('__input--large'),
      isTextarea && getClassName('__input--textarea')
    ),
    disabled: Boolean(disabled),
    id,
    spellCheck: !disableSpellcheck,
    onChange: handleChange,
    onBlur,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
    placeholder,
    ref: refMerger<HTMLInputElement | HTMLTextAreaElement | null>(
      ref,
      innerRef
    ),
    type: 'text',
    value,
  };

  const clearButtonElement =
    hasClearButton && value ? (
      <button
        tabIndex={-1}
        className={getClassName('__clear-icon')}
        onClick={() => onChange('')}
        type="button"
        aria-label={i18n('icu:cancel')}
      />
    ) : null;

  const lengthCountElement = lengthCount >= whenToShowRemainingCount && (
    <div
      className={classNames(getClassName('__remaining-count'), {
        [getClassName('__remaining-count--warn')]:
          lengthCount >= whenToWarnRemainingCount,
      })}
    >
      {maxLengthCount - lengthCount}
    </div>
  );

  return (
    <div
      className={classNames(
        getClassName('__container'),
        expandable && getClassName('__container--expandable'),
        disabled && getClassName('__container--disabled')
      )}
    >
      {icon ? <div className={getClassName('__icon')}>{icon}</div> : null}
      {isTextarea || forceTextarea ? (
        <textarea dir="auto" rows={1} {...inputProps} />
      ) : (
        <input dir="auto" {...inputProps} />
      )}
      {isLarge ? (
        <>
          <div className={getClassName('__controls')}>
            {clearButtonElement}
            {children}
          </div>
          <div className={getClassName('__remaining-count--large')}>
            {lengthCountElement}
          </div>
        </>
      ) : (
        <div className={getClassName('__controls')}>
          {lengthCountElement}
          {clearButtonElement}
          {children}
        </div>
      )}
    </div>
  );
});
