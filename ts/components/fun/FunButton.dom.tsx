// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { type JSX, type Ref } from 'react';
import { VisuallyHidden } from 'react-aria';
import type { LocalizerType } from '../../types/I18N.std.ts';
import { FunStaticEmoji } from './FunEmoji.dom.tsx';
import { Emoji } from '../../axo/emoji.std.ts';
import { AxoIconButton } from '../../axo/AxoIconButton.dom.tsx';
import { forwardExtraPropsForRadix } from '../../axo/_internal/props.dom.tsx';

/**
 * Fun Picker Button
 */

export type FunPickerButtonProps = Readonly<{
  ref?: Ref<HTMLButtonElement>;
  i18n: LocalizerType;
}>;

export function FunPickerButton(props: FunPickerButtonProps): JSX.Element {
  const { ref, i18n, ...rest } = props;
  return (
    <AxoIconButton.Root
      ref={ref}
      symbol="face-smiling"
      variant="implied-secondary"
      label={i18n('icu:FunButton__Label--FunPicker')}
      size="md"
      tooltip={false}
      {...forwardExtraPropsForRadix(rest)}
    />
  );
}

/**
 * Emoji Picker Button
 */

export type FunEmojiPickerButtonProps = Readonly<{
  ref?: Ref<HTMLButtonElement>;
  selectedEmoji?: Emoji.Variant | null;
  i18n: LocalizerType;
}>;

export function FunEmojiPickerButton(
  props: FunEmojiPickerButtonProps
): JSX.Element {
  const { ref, selectedEmoji, i18n, ...rest } = props;

  return (
    <button
      ref={ref}
      type="button"
      className="FunButton"
      {...forwardExtraPropsForRadix(rest)}
    >
      {selectedEmoji != null ? (
        <FunStaticEmoji
          role="img"
          size={20}
          aria-label={Emoji.getDisplayLabel(selectedEmoji)}
          emoji={selectedEmoji}
        />
      ) : (
        <span className="FunButton__Icon FunButton__Icon--EmojiPicker" />
      )}
      <VisuallyHidden>
        {i18n('icu:FunButton__Label--EmojiPicker')}
      </VisuallyHidden>
    </button>
  );
}

/**
 * Sticker Picker Button
 */

export type FunStickerPickerButtonProps = Readonly<{
  ref?: Ref<HTMLButtonElement>;
  i18n: LocalizerType;
}>;

export function FunStickerPickerButton(
  props: FunStickerPickerButtonProps
): JSX.Element {
  const { ref, i18n, ...rest } = props;
  return (
    <button
      ref={ref}
      type="button"
      className="FunButton"
      {...forwardExtraPropsForRadix(rest)}
    >
      <span className="FunButton__Icon FunButton__Icon--StickerPicker" />
      <VisuallyHidden>
        {i18n('icu:FunButton__Label--StickerPicker')}
      </VisuallyHidden>
    </button>
  );
}
