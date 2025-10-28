// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChangeEvent, ClipboardEvent } from 'react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import lodash from 'lodash';

import * as grapheme from '../util/grapheme.std.js';
import { AvatarColorPicker } from './AvatarColorPicker.dom.js';
import { AvatarColors } from '../types/Colors.std.js';
import type { AvatarDataType } from '../types/Avatar.std.js';
import { AvatarModalButtons } from './AvatarModalButtons.dom.js';
import { BetterAvatarBubble } from './BetterAvatarBubble.dom.js';
import type { LocalizerType } from '../types/Util.std.js';
import { avatarDataToBytes } from '../util/avatarDataToBytes.dom.js';
import { createAvatarData } from '../util/createAvatarData.std.js';
import {
  getFittedFontSize,
  getFontSizes,
} from '../util/avatarTextSizeCalculator.std.js';

const { noop } = lodash;

type DoneHandleType = (
  avatarBuffer: Uint8Array,
  avatarData: AvatarDataType
) => unknown;

export type PropsType = {
  avatarData?: AvatarDataType;
  i18n: LocalizerType;
  onCancel: () => unknown;
  onDone: DoneHandleType;
};

const BUBBLE_SIZE = 120;
const MAX_LENGTH = 3;

export function AvatarTextEditor({
  avatarData,
  i18n,
  onCancel,
  onDone,
}: PropsType): JSX.Element {
  const initialText = useMemo(() => avatarData?.text || '', [avatarData]);
  const initialColor = useMemo(
    () => avatarData?.color || AvatarColors[0],
    [avatarData]
  );

  const [inputText, setInputText] = useState(initialText);
  const [fontSize, setFontSize] = useState(getFontSizes(BUBBLE_SIZE).text);
  const [selectedColor, setSelectedColor] = useState(initialColor);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const focusInput = useCallback(() => {
    const inputEl = inputRef?.current;
    if (inputEl) {
      inputEl.focus();
    }
  }, []);

  const handleChange = useCallback(
    (ev: ChangeEvent<HTMLInputElement>) => {
      const { value } = ev.target;
      if (grapheme.count(value) <= MAX_LENGTH) {
        setInputText(ev.target.value);
      }
    },
    [setInputText]
  );

  const handlePaste = useCallback(
    (ev: ClipboardEvent<HTMLInputElement>) => {
      const inputEl = ev.currentTarget;

      const selectionStart = inputEl.selectionStart || 0;
      const selectionEnd = inputEl.selectionEnd || inputEl.selectionStart || 0;
      const textBeforeSelection = inputText.slice(0, selectionStart);
      const textAfterSelection = inputText.slice(selectionEnd);

      const pastedText = ev.clipboardData.getData('Text');

      const newGraphemeCount =
        grapheme.count(textBeforeSelection) +
        grapheme.count(pastedText) +
        grapheme.count(textAfterSelection);

      if (newGraphemeCount > MAX_LENGTH) {
        ev.preventDefault();
      }
    },
    [inputText]
  );

  const onDoneRef = useRef<DoneHandleType>(onDone);

  // Make sure we keep onDoneRef up to date
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const handleDone = useCallback(async () => {
    const newAvatarData = createAvatarData({
      color: selectedColor,
      text: inputText,
    });

    const buffer = await avatarDataToBytes(newAvatarData);

    onDoneRef.current(buffer, newAvatarData);
  }, [inputText, selectedColor]);

  // In case the component unmounts before we're able to create the avatar data
  // we set the done handler to a no-op.
  useEffect(() => {
    return () => {
      onDoneRef.current = noop;
    };
  }, []);

  const measureElRef = useRef<null | HTMLDivElement>(null);
  useEffect(() => {
    const measureEl = measureElRef.current;
    if (!measureEl) {
      return;
    }

    const nextFontSize = getFittedFontSize(
      BUBBLE_SIZE,
      inputText,
      candidateFontSize => {
        measureEl.style.fontSize = `${candidateFontSize}px`;
        const { width, height } = measureEl.getBoundingClientRect();
        return { height, width };
      }
    );

    setFontSize(nextFontSize);
  }, [inputText]);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  const hasChanges =
    initialText !== inputText || selectedColor !== initialColor;

  return (
    <>
      <div className="AvatarEditor__preview">
        <BetterAvatarBubble
          color={selectedColor}
          i18n={i18n}
          onSelect={focusInput}
          style={{
            height: BUBBLE_SIZE,
            width: BUBBLE_SIZE,
          }}
        >
          <input
            className="AvatarTextEditor__input"
            onChange={handleChange}
            onPaste={handlePaste}
            ref={inputRef}
            style={{ fontSize }}
            type="text"
            dir="auto"
            value={inputText}
          />
        </BetterAvatarBubble>
      </div>
      <hr className="AvatarEditor__divider" />
      <AvatarColorPicker
        i18n={i18n}
        onColorSelected={color => {
          setSelectedColor(color);
          focusInput();
        }}
        selectedColor={selectedColor}
      />
      <AvatarModalButtons
        hasChanges={hasChanges}
        i18n={i18n}
        onCancel={onCancel}
        onSave={handleDone}
      />
      <div className="AvatarTextEditor__measure" ref={measureElRef}>
        {inputText}
      </div>
    </>
  );
}
