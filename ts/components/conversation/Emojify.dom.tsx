// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import type { RenderTextCallbackType } from '../../types/Util.std.js';
import { splitByEmoji } from '../../util/emoji.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { FunInlineEmoji } from '../fun/FunEmoji.dom.js';
import {
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
  isEmojiVariantValueNonQualified,
} from '../fun/data/emojis.std.js';
import { createLogger } from '../../logging/log.std.js';
import { useFunEmojiLocalizer } from '../fun/useFunEmojiLocalizer.dom.js';

const log = createLogger('Emojify');

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
  const emojiLocalizer = useFunEmojiLocalizer();
  return (
    <>
      {splitByEmoji(text).map(({ type, value: match }, index) => {
        if (type === 'emoji') {
          // If we don't recognize the emoji, render it as text.
          if (!isEmojiVariantValue(match)) {
            log.warn('Found emoji that we did not recognize', match.length);
            return renderNonEmoji({ text: match, key: index });
          }

          // Render emoji as text if they are a non-qualified emoji value.
          if (isEmojiVariantValueNonQualified(match)) {
            return renderNonEmoji({ text: match, key: index });
          }

          const variantKey = getEmojiVariantKeyByValue(match);
          const variant = getEmojiVariantByKey(variantKey);

          return (
            <FunInlineEmoji
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              role="img"
              aria-label={emojiLocalizer.getLocaleShortName(variantKey)}
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
