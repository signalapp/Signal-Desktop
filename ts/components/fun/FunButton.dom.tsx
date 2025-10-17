// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useMemo } from 'react';
import { VisuallyHidden } from 'react-aria';
import { Button } from 'react-aria-components';
import type { LocalizerType } from '../../types/I18N.std.js';
import {
  type EmojiVariantKey,
  getEmojiVariantByKey,
} from './data/emojis.std.js';
import { FunStaticEmoji } from './FunEmoji.dom.js';
import { useFunEmojiLocalizer } from './useFunEmojiLocalizer.dom.js';

/**
 * Fun Picker Button
 */

export type FunPickerButtonProps = Readonly<{
  i18n: LocalizerType;
}>;

export function FunPickerButton(props: FunPickerButtonProps): JSX.Element {
  const { i18n } = props;
  return (
    <Button className="FunButton">
      <span className="FunButton__Icon FunButton__Icon--FunPicker" />
      <VisuallyHidden>{i18n('icu:FunButton__Label--FunPicker')}</VisuallyHidden>
    </Button>
  );
}

/**
 * Emoji Picker Button
 */

export type FunEmojiPickerButtonProps = Readonly<{
  selectedEmoji?: EmojiVariantKey | null;
  i18n: LocalizerType;
}>;

export function FunEmojiPickerButton(
  props: FunEmojiPickerButtonProps
): JSX.Element {
  const { i18n } = props;
  const emojiLocalizer = useFunEmojiLocalizer();

  const emojiVarant = useMemo(() => {
    if (props.selectedEmoji == null) {
      return null;
    }

    const variantKey = props.selectedEmoji;
    const variant = getEmojiVariantByKey(variantKey);
    return variant;
  }, [props.selectedEmoji]);

  return (
    <Button className="FunButton">
      {emojiVarant ? (
        <FunStaticEmoji
          role="img"
          size={20}
          aria-label={emojiLocalizer.getLocaleShortName(emojiVarant.key)}
          emoji={emojiVarant}
        />
      ) : (
        <span className="FunButton__Icon FunButton__Icon--EmojiPicker" />
      )}
      <VisuallyHidden>
        {i18n('icu:FunButton__Label--EmojiPicker')}
      </VisuallyHidden>
    </Button>
  );
}

/**
 * Sticker Picker Button
 */

export type FunStickerPickerButtonProps = Readonly<{
  i18n: LocalizerType;
}>;

export function FunStickerPickerButton(
  props: FunStickerPickerButtonProps
): JSX.Element {
  const { i18n } = props;
  return (
    <Button className="FunButton">
      <span className="FunButton__Icon FunButton__Icon--StickerPicker" />
      <VisuallyHidden>
        {i18n('icu:FunButton__Label--StickerPicker')}
      </VisuallyHidden>
    </Button>
  );
}
