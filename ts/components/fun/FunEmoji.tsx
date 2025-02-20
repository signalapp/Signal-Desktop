// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import classNames from 'classnames';
import type { CSSProperties } from 'react';
import React from 'react';
import type { EmojiVariantData } from './data/emojis';

export type FunEmojiSize = 16 | 32;

export type FunEmojiProps = Readonly<{
  role: 'img' | 'presentation';
  'aria-label': string;
  size: FunEmojiSize;
  emoji: EmojiVariantData;
}>;

const sizeToClassName: Record<FunEmojiSize, string> = {
  16: 'FunEmoji--Size16',
  32: 'FunEmoji--Size32',
};

export function FunEmoji(props: FunEmojiProps): JSX.Element {
  return (
    <div
      role={props.role}
      aria-label={props['aria-label']}
      className={classNames('FunEmoji', sizeToClassName[props.size])}
      style={
        {
          '--fun-emoji-sheet-x': props.emoji.sheetX,
          '--fun-emoji-sheet-y': props.emoji.sheetY,
        } as CSSProperties
      }
    />
  );
}
