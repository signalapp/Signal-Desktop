// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useCallback,
  useState,
  useEffect,
  type HTMLProps,
  forwardRef,
} from 'react';
import { Button } from 'react-aria-components';
import { useDelayedRestoreFocus } from '../../hooks/useRestoreFocus.dom.ts';
import type { LocalizerType, ThemeType } from '../../types/Util.std.ts';
import {
  ReactionPickerPicker,
  ReactionPickerPickerEmojiButton,
  ReactionPickerPickerStyle,
} from '../ReactionPickerPicker.dom.tsx';
import { FunEmojiPicker } from '../fun/FunEmojiPicker.dom.tsx';
import type { FunEmojiSelection } from '../fun/panels/FunPanelEmojis.dom.tsx';
import type { Emoji } from '../../axo/emoji.std.ts';

export type OwnProps = {
  i18n: LocalizerType;
  selected?: Emoji.Variant;
  onClose?: () => unknown;
  onPick: (emoji: Emoji.Variant) => unknown;
  preferredReactionEmoji: ReadonlyArray<Emoji.Variant>;
  theme?: ThemeType;
  messageEmojis?: ReadonlyArray<Emoji.Variant>;
};

export type Props = OwnProps & Pick<HTMLProps<HTMLDivElement>, 'style'>;

export const ReactionPicker = forwardRef<HTMLDivElement, Props>(
  function ReactionPickerInner(
    {
      i18n,
      onClose,
      onPick,
      preferredReactionEmoji,
      selected,
      style,
      theme,
      messageEmojis,
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

    const onSelectEmoji = useCallback(
      (emojiSelection: FunEmojiSelection) => {
        onPick(emojiSelection.emoji);
      },
      [onPick]
    );

    // Focus first button and restore focus on unmount
    const [focusRef] = useDelayedRestoreFocus();

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
              // oxlint-disable-next-line react/no-array-index-key
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
          <FunEmojiPicker
            open={emojiPickerOpen}
            onOpenChange={handleFunEmojiPickerOpenChange}
            onSelectEmoji={onSelectEmoji}
            theme={theme}
            showCustomizePreferredReactionsButton
            closeOnSelect
            messageEmojis={messageEmojis}
          >
            <Button
              aria-label={i18n('icu:Reactions--more')}
              className="module-ReactionPickerPicker__button module-ReactionPickerPicker__button--more"
            />
          </FunEmojiPicker>
        )}
      </ReactionPickerPicker>
    );
  }
);
