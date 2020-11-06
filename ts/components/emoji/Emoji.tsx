// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import { emojiToImage, getImagePath, SkinToneKey } from './lib';

export const EmojiSizes = [16, 18, 20, 24, 28, 32, 48, 64, 66] as const;

export type EmojiSizeType = typeof EmojiSizes[number];

export type OwnProps = {
  emoji?: string;
  shortName?: string;
  skinTone?: SkinToneKey | number;
  size?: EmojiSizeType;
  children?: React.ReactNode;
};

export type Props = OwnProps &
  Pick<React.HTMLProps<HTMLDivElement>, 'style' | 'className'>;

// the DOM structure of this Emoji should match the other emoji implementations:
// ts/components/conversation/Emojify.tsx
// ts/quill/emoji/blot.tsx

export const Emoji = React.memo(
  React.forwardRef<HTMLDivElement, Props>(
    (
      { style = {}, size = 28, shortName, skinTone, emoji, className }: Props,
      ref
    ) => {
      let image = '';
      if (shortName) {
        image = getImagePath(shortName, skinTone);
      } else if (emoji) {
        image = emojiToImage(emoji) || '';
      }

      return (
        <span
          ref={ref}
          className={classNames(
            'module-emoji',
            `module-emoji--${size}px`,
            className
          )}
          style={style}
        >
          <img
            className={`module-emoji__image--${size}px`}
            src={image}
            aria-label={emoji}
            title={emoji}
          />
        </span>
      );
    }
  )
);
