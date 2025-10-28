// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useRef, useCallback, useState } from 'react';
import type { LocalizerType } from '../types/I18N.std.js';
import type { InputApi } from './CompositionInput.dom.js';
import { CompositionInput } from './CompositionInput.dom.js';
import {
  hydrateRanges,
  type DraftBodyRanges,
  type HydratedBodyRangesType,
} from '../types/BodyRange.std.js';
import type { ThemeType } from '../types/Util.std.js';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges.preload.js';
import * as grapheme from '../util/grapheme.std.js';
import { FunEmojiPicker } from './fun/FunEmojiPicker.dom.js';
import type { FunEmojiSelection } from './fun/panels/FunPanelEmojis.dom.js';
import type { EmojiSkinTone } from './fun/data/emojis.std.js';
import { FunEmojiPickerButton } from './fun/FunButton.dom.js';
import type { GetConversationByIdType } from '../state/selectors/conversations.dom.js';

export type CompositionTextAreaProps = {
  bodyRanges: HydratedBodyRangesType | null;
  i18n: LocalizerType;
  isActive: boolean;
  isFormattingEnabled: boolean;
  maxLength?: number;
  placeholder?: string;
  whenToShowRemainingCount?: number;
  onScroll?: (ev: React.UIEvent<HTMLElement, UIEvent>) => void;
  onSelectEmoji: (emojiSelection: FunEmojiSelection) => void;
  onChange: (
    messageText: string,
    draftBodyRanges: HydratedBodyRangesType,
    caretLocation?: number | undefined
  ) => void;
  emojiSkinToneDefault: EmojiSkinTone;
  onEmojiSkinToneDefaultChange: (emojiSkinToneDefault: EmojiSkinTone) => void;
  onSubmit: (
    message: string,
    draftBodyRanges: DraftBodyRanges,
    timestamp: number
  ) => void;
  onTextTooLong: () => void;
  ourConversationId: string | undefined;
  platform: string;
  getPreferredBadge: PreferredBadgeSelectorType;
  draftText: string;
  theme: ThemeType;
  conversationSelector: GetConversationByIdType;
};

/**
 * Essentially an HTML textarea but with support for emoji picker and
 * at-mentions autocomplete.
 *
 * Meant for modals that need to collect a message or caption. It is
 * basically a rectangle input with an emoji selector floating at the top-right
 */
export function CompositionTextArea({
  bodyRanges,
  draftText,
  getPreferredBadge,
  i18n,
  isActive,
  isFormattingEnabled,
  maxLength,
  onChange,
  onSelectEmoji,
  onScroll,
  onSubmit,
  onTextTooLong,
  ourConversationId,
  placeholder,
  platform,
  emojiSkinToneDefault,
  theme,
  whenToShowRemainingCount = Infinity,
  conversationSelector,
}: CompositionTextAreaProps): JSX.Element {
  const inputApiRef = useRef<InputApi | undefined>();
  const [characterCount, setCharacterCount] = useState(
    grapheme.count(draftText)
  );

  const handleSelectEmoji = useCallback(
    (emojiSelection: FunEmojiSelection) => {
      if (inputApiRef.current) {
        inputApiRef.current.insertEmoji(emojiSelection);
        onSelectEmoji(emojiSelection);
      }
    },
    [onSelectEmoji]
  );

  const focusTextEditInput = useCallback(() => {
    if (inputApiRef.current) {
      inputApiRef.current.focus();
    }
  }, [inputApiRef]);

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const handleEmojiPickerOpenChange = useCallback(
    (open: boolean) => {
      setEmojiPickerOpen(open);
      if (!open) {
        focusTextEditInput();
      }
    },
    [focusTextEditInput]
  );

  const handleChange = useCallback(
    ({
      bodyRanges: updatedBodyRanges,
      caretLocation,
      messageText: newValue,
    }: {
      bodyRanges: DraftBodyRanges;
      caretLocation?: number | undefined;
      messageText: string;
    }) => {
      const inputEl = inputApiRef.current;
      if (!inputEl) {
        return;
      }

      const [newValueSized, newCharacterCount] = grapheme.truncateAndSize(
        newValue,
        maxLength
      );

      const hydratedBodyRanges =
        hydrateRanges(updatedBodyRanges, conversationSelector) ?? [];

      if (maxLength !== undefined) {
        // if we had to truncate
        if (newValueSized.length < newValue.length) {
          // reset quill to the value before the change that pushed it over the max
          // and push the cursor to the end
          //
          // this is not perfect as it pushes the cursor to the end, even if the user
          // was modifying text in the middle of the editor
          // a better solution would be to prevent the change to begin with, but
          // quill makes this VERY difficult
          inputEl.setContents(newValueSized, hydratedBodyRanges, true);
        }
      }
      setCharacterCount(newCharacterCount);
      onChange(newValue, hydratedBodyRanges, caretLocation);
    },
    [maxLength, onChange, conversationSelector]
  );

  return (
    <div className="CompositionTextArea">
      <CompositionInput
        draftBodyRanges={bodyRanges}
        draftText={draftText}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        isActive={isActive}
        isFormattingEnabled={isFormattingEnabled}
        inputApi={inputApiRef}
        large={false}
        moduleClassName="CompositionTextArea__input"
        onEditorStateChange={handleChange}
        onSelectEmoji={onSelectEmoji}
        onScroll={onScroll}
        onSubmit={onSubmit}
        onTextTooLong={onTextTooLong}
        ourConversationId={ourConversationId}
        placeholder={placeholder}
        platform={platform}
        quotedMessageId={null}
        sendCounter={0}
        theme={theme}
        emojiSkinToneDefault={emojiSkinToneDefault}
        // These do not apply in the forward modal because there isn't
        // strictly one conversation
        conversationId={null}
        sortedGroupMembers={null}
        // we don't edit in this context
        draftEditMessage={null}
        // rendered in the forward modal
        linkPreviewResult={null}
        // Panels appear behind this modal
        shouldHidePopovers={null}
      />
      <div className="CompositionTextArea__emoji">
        <FunEmojiPicker
          placement="bottom"
          open={emojiPickerOpen}
          onOpenChange={handleEmojiPickerOpenChange}
          onSelectEmoji={handleSelectEmoji}
          closeOnSelect={false}
        >
          <FunEmojiPickerButton i18n={i18n} />
        </FunEmojiPicker>
      </div>
      {maxLength !== undefined &&
        characterCount >= whenToShowRemainingCount && (
          <div className="CompositionTextArea__remaining-character-count">
            {maxLength - characterCount}
          </div>
        )}
    </div>
  );
}
