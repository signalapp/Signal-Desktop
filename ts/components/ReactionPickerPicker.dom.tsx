// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties, ReactNode } from 'react';
import React, { forwardRef } from 'react';
import classNames from 'classnames';

import { Button } from 'react-aria-components';
import type { LocalizerType } from '../types/Util.std.js';
import { FunStaticEmoji } from './fun/FunEmoji.dom.js';
import { strictAssert } from '../util/assert.std.js';
import {
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
} from './fun/data/emojis.std.js';

export enum ReactionPickerPickerStyle {
  Picker,
  Menu,
}

export const ReactionPickerPickerEmojiButton = React.forwardRef<
  HTMLButtonElement,
  {
    emoji: string;
    isSelected: boolean;
    onClick: () => unknown;
    title?: string;
  }
>(function ReactionPickerPickerEmojiButtonInner(
  { emoji, onClick, isSelected, title },
  ref
) {
  strictAssert(
    isEmojiVariantValue(emoji),
    'Expected a valid emoji variant value'
  );
  const emojiVariantKey = getEmojiVariantKeyByValue(emoji);
  const emojiVariant = getEmojiVariantByKey(emojiVariantKey);

  return (
    <Button
      ref={ref}
      className={classNames(
        'module-ReactionPickerPicker__button',
        'module-ReactionPickerPicker__button--emoji',
        isSelected && 'module-ReactionPickerPicker__button--selected'
      )}
      onPress={onClick}
    >
      <FunStaticEmoji
        role="img"
        aria-label={title ?? ''}
        size={48}
        emoji={emojiVariant}
      />
    </Button>
  );
});

export function ReactionPickerPickerMoreButton({
  i18n,
  onClick,
}: Readonly<{
  i18n: LocalizerType;
  onClick: () => unknown;
}>): JSX.Element {
  return (
    <button
      aria-label={i18n('icu:Reactions--more')}
      className="module-ReactionPickerPicker__button module-ReactionPickerPicker__button--more"
      onClick={event => {
        event.stopPropagation();
        onClick();
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === 'Space') {
          event.stopPropagation();
          event.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      title={i18n('icu:Reactions--more')}
      type="button"
    />
  );
}

export const ReactionPickerPicker = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    isSomethingSelected: boolean;
    pickerStyle: ReactionPickerPickerStyle;
    style?: CSSProperties;
  }
>(function ReactionPickerPickerInner(
  { children, isSomethingSelected, pickerStyle, style },
  ref
) {
  return (
    <div
      className={classNames(
        'module-ReactionPickerPicker',
        isSomethingSelected &&
          'module-ReactionPickerPicker--something-selected',
        {
          'module-ReactionPickerPicker--picker-style':
            pickerStyle === ReactionPickerPickerStyle.Picker,
          'module-ReactionPickerPicker--menu-style':
            pickerStyle === ReactionPickerPickerStyle.Menu,
        }
      )}
      ref={ref}
      style={style}
    >
      {children}
    </div>
  );
});
