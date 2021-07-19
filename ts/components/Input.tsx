import React, {
  ClipboardEvent,
  ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import classNames from 'classnames';

import * as grapheme from '../util/grapheme';
import { LocalizerType } from '../types/Util';
import { getClassNamesFor } from '../util/getClassNamesFor';
import { multiRef } from '../util/multiRef';

export type PropsType = {
  disabled?: boolean;
  expandable?: boolean;
  hasClearButton?: boolean;
  i18n: LocalizerType;
  icon?: ReactNode;
  maxGraphemeCount?: number;
  moduleClassName?: string;
  onChange: (value: string) => unknown;
  placeholder: string;
  value?: string;
  whenToShowRemainingCount?: number;
};

/**
 * Some inputs must have fewer than maxGraphemeCount glyphs. Ideally, we'd use the
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
>(
  (
    {
      disabled,
      expandable,
      hasClearButton,
      i18n,
      icon,
      maxGraphemeCount = 0,
      moduleClassName,
      onChange,
      placeholder,
      value = '',
      whenToShowRemainingCount = Infinity,
    },
    ref
  ) => {
    const innerRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(
      null
    );
    const valueOnKeydownRef = useRef<string>(value);
    const selectionStartOnKeydownRef = useRef<number>(value.length);
    const [isLarge, setIsLarge] = useState(false);

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

    const handleKeyDown = useCallback(() => {
      const inputEl = innerRef.current;
      if (!inputEl) {
        return;
      }

      valueOnKeydownRef.current = inputEl.value;
      selectionStartOnKeydownRef.current = inputEl.selectionStart || 0;
    }, []);

    const handleChange = useCallback(() => {
      const inputEl = innerRef.current;
      if (!inputEl) {
        return;
      }

      const newValue = inputEl.value;

      const newGraphemeCount = maxGraphemeCount ? grapheme.count(newValue) : 0;

      if (newGraphemeCount <= maxGraphemeCount) {
        onChange(newValue);
      } else {
        inputEl.value = valueOnKeydownRef.current;
        inputEl.selectionStart = selectionStartOnKeydownRef.current;
        inputEl.selectionEnd = selectionStartOnKeydownRef.current;
      }

      maybeSetLarge();
    }, [maxGraphemeCount, maybeSetLarge, onChange]);

    const handlePaste = useCallback(
      (event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const inputEl = innerRef.current;
        if (!inputEl || !maxGraphemeCount) {
          return;
        }

        const selectionStart = inputEl.selectionStart || 0;
        const selectionEnd =
          inputEl.selectionEnd || inputEl.selectionStart || 0;
        const textBeforeSelection = value.slice(0, selectionStart);
        const textAfterSelection = value.slice(selectionEnd);

        const pastedText = event.clipboardData.getData('Text');

        const newGraphemeCount =
          grapheme.count(textBeforeSelection) +
          grapheme.count(pastedText) +
          grapheme.count(textAfterSelection);

        if (newGraphemeCount > maxGraphemeCount) {
          event.preventDefault();
        }

        maybeSetLarge();
      },
      [maxGraphemeCount, maybeSetLarge, value]
    );

    useEffect(() => {
      maybeSetLarge();
    }, [maybeSetLarge]);

    const graphemeCount = maxGraphemeCount ? grapheme.count(value) : -1;
    const getClassName = getClassNamesFor('Input', moduleClassName);

    const inputProps = {
      className: classNames(
        getClassName('__input'),
        icon && getClassName('__input--with-icon'),
        isLarge && getClassName('__input--large')
      ),
      disabled: Boolean(disabled),
      onChange: handleChange,
      onKeyDown: handleKeyDown,
      onPaste: handlePaste,
      placeholder,
      ref: multiRef<HTMLInputElement | HTMLTextAreaElement | null>(
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
          aria-label={i18n('cancel')}
        />
      ) : null;

    const graphemeCountElement = graphemeCount >= whenToShowRemainingCount && (
      <div className={getClassName('__remaining-count')}>
        {maxGraphemeCount - graphemeCount}
      </div>
    );

    return (
      <div
        className={classNames(
          getClassName('__container'),
          disabled && getClassName('__container--disabled')
        )}
      >
        {icon ? <div className={getClassName('__icon')}>{icon}</div> : null}
        {expandable ? <textarea {...inputProps} /> : <input {...inputProps} />}
        {isLarge ? (
          <>
            <div className={getClassName('__controls')}>
              {clearButtonElement}
            </div>
            <div className={getClassName('__remaining-count--large')}>
              {graphemeCountElement}
            </div>
          </>
        ) : (
          <div className={getClassName('__controls')}>
            {graphemeCountElement}
            {clearButtonElement}
          </div>
        )}
      </div>
    );
  }
);
