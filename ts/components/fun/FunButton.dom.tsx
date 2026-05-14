// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { type JSX } from 'react';
import { Pressable, VisuallyHidden } from 'react-aria';
import { Button } from 'react-aria-components';
import type { LocalizerType } from '../../types/I18N.std.ts';
import { FunStaticEmoji } from './FunEmoji.dom.tsx';
import { Emoji } from '../../axo/emoji.std.ts';
import { AxoIconButton } from '../../axo/AxoIconButton.dom.tsx';

/**
 * Fun Picker Button
 */

export type FunPickerButtonProps = Readonly<{
  i18n: LocalizerType;
}>;

export function FunPickerButton(props: FunPickerButtonProps): JSX.Element {
  const { i18n } = props;
  return (
    <Pressable>
      <AxoIconButton.Root
        symbol="emoji"
        variant="borderless-secondary"
        label={i18n('icu:FunButton__Label--FunPicker')}
        size="md"
        tooltip={false}
      />
    </Pressable>
  );
}

/**
 * Emoji Picker Button
 */

export type FunEmojiPickerButtonProps = Readonly<{
  selectedEmoji?: Emoji.Variant | null;
  i18n: LocalizerType;
}>;

export function FunEmojiPickerButton(
  props: FunEmojiPickerButtonProps
): JSX.Element {
  const { i18n } = props;

  return (
    <Button className="FunButton">
      {props.selectedEmoji != null ? (
        <FunStaticEmoji
          role="img"
          size={20}
          aria-label={Emoji.getDisplayLabel(props.selectedEmoji)}
          emoji={props.selectedEmoji}
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
