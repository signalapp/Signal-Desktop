// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState, useEffect } from 'react';
import { Button } from 'react-aria-components';
import { convertShortName } from '../emoji/lib';
import type { Props as EmojiPickerProps } from '../emoji/EmojiPicker';
import { useDelayedRestoreFocus } from '../../hooks/useRestoreFocus';
import type { LocalizerType, ThemeType } from '../../types/Util';
import {
  ReactionPickerPicker,
  ReactionPickerPickerEmojiButton,
  ReactionPickerPickerMoreButton,
  ReactionPickerPickerStyle,
} from '../ReactionPickerPicker';
import type { EmojiSkinTone } from '../fun/data/emojis';
import { getEmojiVariantByKey } from '../fun/data/emojis';
import { FunEmojiPicker } from '../fun/FunEmojiPicker';
import type { FunEmojiSelection } from '../fun/panels/FunPanelEmojis';
import { isFunPickerEnabled } from '../fun/isFunPickerEnabled';

export type RenderEmojiPickerProps = Pick<Props, 'onClose' | 'style'> &
  Pick<
    EmojiPickerProps,
    'onClickSettings' | 'onPickEmoji' | 'onEmojiSkinToneDefaultChange'
  > & {
    ref: React.Ref<HTMLDivElement>;
  };

export type OwnProps = {
  i18n: LocalizerType;
  selected?: string;
  onClose?: () => unknown;
  onPick: (emoji: string) => unknown;
  onEmojiSkinToneDefaultChange: (emojiSkinTone: EmojiSkinTone) => unknown;
  openCustomizePreferredReactionsModal?: () => unknown;
  preferredReactionEmoji: ReadonlyArray<string>;
  renderEmojiPicker: (props: RenderEmojiPickerProps) => React.ReactElement;
  theme?: ThemeType;
};

export type Props = OwnProps & Pick<React.HTMLProps<HTMLDivElement>, 'style'>;

export const ReactionPicker = React.forwardRef<HTMLDivElement, Props>(
  function ReactionPickerInner(
    {
      i18n,
      onClose,
      onPick,
      onEmojiSkinToneDefaultChange,
      openCustomizePreferredReactionsModal,
      preferredReactionEmoji,
      renderEmojiPicker,
      selected,
      style,
      theme,
    },
    ref
  ) {
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

    // Handle escape key
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (onClose && e.key === 'Escape' && !emojiPickerOpen) {
          onClose();
        }
      };

      document.addEventListener('keydown', handler);

      return () => {
        document.removeEventListener('keydown', handler);
      };
    }, [onClose, emojiPickerOpen]);

    const handleFunEmojiPickerOpenChange = useCallback((open: boolean) => {
      setEmojiPickerOpen(open);
    }, []);

    // Handle EmojiPicker::onPickEmoji
    const onPickEmoji: EmojiPickerProps['onPickEmoji'] = React.useCallback(
      ({ shortName, skinTone: pickedSkinTone }) => {
        onPick(convertShortName(shortName, pickedSkinTone));
      },
      [onPick]
    );

    const onSelectEmoji = useCallback(
      (emojiSelection: FunEmojiSelection) => {
        const variant = getEmojiVariantByKey(emojiSelection.variantKey);
        onPick(variant.value);
      },
      [onPick]
    );

    // Focus first button and restore focus on unmount
    const [focusRef] = useDelayedRestoreFocus();

    if (!isFunPickerEnabled() && emojiPickerOpen) {
      return renderEmojiPicker({
        onClickSettings: openCustomizePreferredReactionsModal,
        onClose,
        onPickEmoji,
        onEmojiSkinToneDefaultChange,
        ref,
        style,
      });
    }

    const otherSelected =
      selected != null && !preferredReactionEmoji.includes(selected);

    return (
      <ReactionPickerPicker
        isSomethingSelected={typeof selected === 'number'}
        pickerStyle={ReactionPickerPickerStyle.Picker}
        ref={ref}
        style={style}
      >
        {preferredReactionEmoji.map((emoji, index) => {
          const maybeFocusRef = index === 0 ? focusRef : undefined;
          const isSelected = emoji === selected;

          return (
            <ReactionPickerPickerEmojiButton
              emoji={emoji}
              isSelected={isSelected}
              // The index is the only thing that uniquely identifies the emoji, because
              //   there can be duplicates in the list.
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              onClick={() => {
                onPick(emoji);
              }}
              ref={maybeFocusRef}
            />
          );
        })}
        {otherSelected ? (
          <ReactionPickerPickerEmojiButton
            emoji={selected}
            onClick={() => {
              onPick(selected);
            }}
            isSelected
            title={i18n('icu:Reactions--remove')}
          />
        ) : (
          <>
            {isFunPickerEnabled() && (
              <FunEmojiPicker
                open={emojiPickerOpen}
                onOpenChange={handleFunEmojiPickerOpenChange}
                onSelectEmoji={onSelectEmoji}
                theme={theme}
                showCustomizePreferredReactionsButton
              >
                <Button
                  aria-label={i18n('icu:Reactions--more')}
                  className="module-ReactionPickerPicker__button module-ReactionPickerPicker__button--more"
                />
              </FunEmojiPicker>
            )}
            {!isFunPickerEnabled() && (
              <ReactionPickerPickerMoreButton
                i18n={i18n}
                onClick={() => {
                  setEmojiPickerOpen(true);
                }}
              />
            )}
          </>
        )}
      </ReactionPickerPicker>
    );
  }
);
