// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import classNames from 'classnames';

import type { RenderTextCallbackType } from '../../types/Util';
import { splitByEmoji } from '../../util/emoji';
import { missingCaseError } from '../../util/missingCaseError';
import type { SizeClassType } from '../emoji/lib';
import { emojiToImage } from '../emoji/lib';

// Some of this logic taken from emoji-js/replacement
// the DOM structure for this getImageTag should match the other emoji implementations:
// ts/components/emoji/Emoji.tsx
// ts/quill/emoji/blot.tsx
function getImageTag({
  isInvisible,
  key,
  match,
  sizeClass,
}: {
  isInvisible?: boolean;
  key: string | number;
  match: string;
  sizeClass?: SizeClassType;
}): JSX.Element | string {
  const img = emojiToImage(match);

  if (!img) {
    return match;
  }

  return (
    <img
      key={key}
      src={img}
      aria-label={match}
      className={classNames(
        'emoji',
        sizeClass,
        isInvisible ? 'emoji--invisible' : null
      )}
      alt={match}
    />
  );
}

export type Props = {
  /** When behind a spoiler, this emoji needs to be visibility: hidden */
  isInvisible?: boolean;
  /** A class name to be added to the generated emoji images */
  sizeClass?: SizeClassType;
  /** Allows you to customize now non-newlines are rendered. Simplest is just a <span>. */
  renderNonEmoji?: RenderTextCallbackType;
  text: string;
};

const defaultRenderNonEmoji: RenderTextCallbackType = ({ text }) => text;

export function Emojify({
  isInvisible,
  renderNonEmoji = defaultRenderNonEmoji,
  sizeClass,
  text,
}: Props): JSX.Element {
  return (
    <>
      {splitByEmoji(text).map(({ type, value: match }, index) => {
        if (type === 'emoji') {
          return getImageTag({ isInvisible, match, sizeClass, key: index });
        }

        if (type === 'text') {
          return renderNonEmoji({ text: match, key: index });
        }

        throw missingCaseError(type);
      })}
    </>
  );
}
