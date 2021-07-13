// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  ClipboardEvent,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from 'react';
import classNames from 'classnames';

import { LocalizerType } from '../types/Util';
import { multiRef } from '../util/multiRef';
import * as grapheme from '../util/grapheme';

const MAX_GRAPHEME_COUNT = 256;
const SHOW_REMAINING_COUNT = 150;

type PropsType = {
  disabled?: boolean;
  i18n: LocalizerType;
  onChangeValue: (value: string) => void;
  value: string;
};

/**
 * Group titles must have fewer than MAX_GRAPHEME_COUNT glyphs. Ideally, we'd use the
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
export const GroupDescriptionInput = forwardRef<HTMLTextAreaElement, PropsType>(
  ({ i18n, disabled = false, onChangeValue, value }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const valueOnKeydownRef = useRef<string>(value);
    const selectionStartOnKeydownRef = useRef<number>(value.length);
    const [isLarge, setIsLarge] = useState(false);

    function maybeSetLarge() {
      const inputEl = innerRef.current;
      if (!inputEl) {
        return;
      }

      if (inputEl.scrollHeight > inputEl.clientHeight) {
        setIsLarge(true);
      }
    }

    const onKeyDown = () => {
      const inputEl = innerRef.current;
      if (!inputEl) {
        return;
      }

      valueOnKeydownRef.current = inputEl.value;
      selectionStartOnKeydownRef.current = inputEl.selectionStart || 0;
    };

    const onChange = () => {
      const inputEl = innerRef.current;
      if (!inputEl) {
        return;
      }

      const newValue = inputEl.value;
      const newGraphemeCount = grapheme.count(newValue);

      if (newGraphemeCount <= MAX_GRAPHEME_COUNT) {
        onChangeValue(newValue);
      } else {
        inputEl.value = valueOnKeydownRef.current;
        inputEl.selectionStart = selectionStartOnKeydownRef.current;
        inputEl.selectionEnd = selectionStartOnKeydownRef.current;
      }

      maybeSetLarge();
    };

    const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const inputEl = innerRef.current;
      if (!inputEl) {
        return;
      }

      const selectionStart = inputEl.selectionStart || 0;
      const selectionEnd = inputEl.selectionEnd || inputEl.selectionStart || 0;
      const textBeforeSelection = value.slice(0, selectionStart);
      const textAfterSelection = value.slice(selectionEnd);

      const pastedText = event.clipboardData.getData('Text');

      const newGraphemeCount =
        grapheme.count(textBeforeSelection) +
        grapheme.count(pastedText) +
        grapheme.count(textAfterSelection);

      if (newGraphemeCount > MAX_GRAPHEME_COUNT) {
        event.preventDefault();
      }

      maybeSetLarge();
    };

    useEffect(() => {
      maybeSetLarge();
    }, []);

    const graphemeCount = grapheme.count(value);

    return (
      <>
        <div className="module-GroupInput--container module-GroupInput__description--container">
          <textarea
            className={classNames({
              'module-GroupInput': true,
              'module-GroupInput__description': true,
              'module-GroupInput__description--large': isLarge,
            })}
            disabled={disabled}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={i18n(
              'setGroupMetadata__group-description-placeholder'
            )}
            ref={multiRef<HTMLTextAreaElement>(ref, innerRef)}
            value={value}
          />
          {graphemeCount >= SHOW_REMAINING_COUNT && (
            <div className="module-GroupInput__description--remaining">
              {MAX_GRAPHEME_COUNT - graphemeCount}
            </div>
          )}
        </div>
      </>
    );
  }
);
