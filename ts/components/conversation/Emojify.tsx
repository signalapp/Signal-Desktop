// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import type { RenderTextCallbackType } from '../../types/Util';
import { splitByEmoji } from '../../util/emoji';
import { missingCaseError } from '../../util/missingCaseError';
import { FunInlineEmoji } from '../fun/FunEmoji';
import {
  getEmojiParentByKey,
  getEmojiParentKeyByVariantKey,
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
} from '../fun/data/emojis';
import { strictAssert } from '../../util/assert';

export type Props = {
  fontSizeOverride?: number | null;
  text: string;
  /** When behind a spoiler, this emoji needs to be visibility: hidden */
  isInvisible?: boolean;
  /** Allows you to customize now non-newlines are rendered. Simplest is just a <span>. */
  renderNonEmoji?: RenderTextCallbackType;
};

const defaultRenderNonEmoji: RenderTextCallbackType = ({ text }) => text;

export function Emojify({
  fontSizeOverride,
  text,
  renderNonEmoji = defaultRenderNonEmoji,
}: Props): JSX.Element {
  return (
    <>
      {splitByEmoji(text).map(({ type, value: match }, index) => {
        if (type === 'emoji') {
          strictAssert(
            isEmojiVariantValue(match),
            `Must be emoji variant value: ${match}`
          );

          const variantKey = getEmojiVariantKeyByValue(match);
          const variant = getEmojiVariantByKey(variantKey);
          const parentKey = getEmojiParentKeyByVariantKey(variantKey);
          const parent = getEmojiParentByKey(parentKey);

          return (
            <FunInlineEmoji
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              role="img"
              aria-label={parent.englishShortNameDefault}
              emoji={variant}
              size={fontSizeOverride}
            />
          );
        }

        if (type === 'text') {
          return renderNonEmoji({ text: match, key: index });
        }

        throw missingCaseError(type);
      })}
    </>
  );
}
