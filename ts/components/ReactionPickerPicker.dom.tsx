// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties, ReactNode } from 'react';
import { forwardRef } from 'react';
import classNames from 'classnames';
import { Button } from 'react-aria-components';
import { FunStaticEmoji } from './fun/FunEmoji.dom.tsx';
import { createLogger } from '../logging/log.std.ts';
import { Emoji } from '../axo/emoji.std.ts';

const log = createLogger('ReactionPickerPicker');

export enum ReactionPickerPickerStyle {
  Picker,
  Menu,
}

export const ReactionPickerPickerEmojiButton = forwardRef<
  HTMLButtonElement,
  {
    emoji: Emoji.Variant;
    isSelected: boolean;
    onClick: () => unknown;
    title?: string;
  }
>(function ReactionPickerPickerEmojiButtonInner(
  { emoji, onClick, isSelected, title },
  ref
) {
  if (!Emoji.isEmoji(emoji)) {
    log.error(
      `Expected a valid emoji variant value, got ${Emoji.getDebugLabel(emoji)}`
    );
    return null;
  }

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
        emoji={emoji}
      />
    </Button>
  );
});

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
