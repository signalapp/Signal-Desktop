// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback, useRef } from 'react';
import lodash from 'lodash';

import type { LocalizerType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';
import { Button, ButtonVariant } from './Button.dom.js';
import {
  ReactionPickerPicker,
  ReactionPickerPickerEmojiButton,
  ReactionPickerPickerStyle,
} from './ReactionPickerPicker.dom.js';
import { DEFAULT_PREFERRED_REACTION_EMOJI_PARENT_KEYS } from '../reactions/constants.std.js';
import {
  EmojiSkinTone,
  getEmojiVariantByKey,
  getEmojiVariantByParentKeyAndSkinTone,
} from './fun/data/emojis.std.js';
import { FunEmojiPicker } from './fun/FunEmojiPicker.dom.js';
import type { FunEmojiSelection } from './fun/panels/FunPanelEmojis.dom.js';

const { isEqual } = lodash;

export type PropsType = {
  draftPreferredReactions: ReadonlyArray<string>;
  hadSaveError: boolean;
  i18n: LocalizerType;
  isSaving: boolean;
  originalPreferredReactions: ReadonlyArray<string>;
  recentEmojis: ReadonlyArray<string>;
  selectedDraftEmojiIndex: undefined | number;
  emojiSkinToneDefault: EmojiSkinTone | null;

  cancelCustomizePreferredReactionsModal(): unknown;
  deselectDraftEmoji(): unknown;
  onEmojiSkinToneDefaultChange: (emojiSkinToneDefault: EmojiSkinTone) => void;
  replaceSelectedDraftEmoji(newEmoji: string): unknown;
  resetDraftEmoji(): unknown;
  savePreferredReactions(): unknown;
  selectDraftEmojiToBeReplaced(index: number): unknown;
};

export function CustomizingPreferredReactionsModal({
  cancelCustomizePreferredReactionsModal,
  deselectDraftEmoji,
  draftPreferredReactions,
  emojiSkinToneDefault,
  hadSaveError,
  i18n,
  isSaving,
  originalPreferredReactions,
  replaceSelectedDraftEmoji,
  resetDraftEmoji,
  savePreferredReactions,
  selectDraftEmojiToBeReplaced,
  selectedDraftEmojiIndex,
}: Readonly<PropsType>): JSX.Element {
  const pickerRef = useRef<HTMLDivElement>(null);

  const isSomethingSelected = selectedDraftEmojiIndex !== undefined;

  const hasChanged = !isEqual(
    originalPreferredReactions,
    draftPreferredReactions
  );
  const canReset =
    !isSaving &&
    !isEqual(
      DEFAULT_PREFERRED_REACTION_EMOJI_PARENT_KEYS.map(parentKey => {
        const variant = getEmojiVariantByParentKeyAndSkinTone(
          parentKey,
          emojiSkinToneDefault ?? EmojiSkinTone.None
        );
        return variant.value;
      }),
      draftPreferredReactions
    );
  const canSave = !isSaving && hasChanged;

  const footer = (
    <>
      <Button
        disabled={!canReset}
        onClick={() => {
          resetDraftEmoji();
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === 'Space') {
            resetDraftEmoji();
          }
        }}
        variant={ButtonVariant.SecondaryAffirmative}
      >
        {i18n('icu:reset')}
      </Button>
      <Button
        disabled={!canSave}
        onClick={() => {
          savePreferredReactions();
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === 'Space') {
            savePreferredReactions();
          }
        }}
      >
        {i18n('icu:save')}
      </Button>
    </>
  );

  return (
    <Modal
      modalName="CustomizingPreferredReactionsModal"
      moduleClassName="module-CustomizingPreferredReactionsModal"
      hasXButton
      i18n={i18n}
      onClose={() => {
        cancelCustomizePreferredReactionsModal();
      }}
      title={i18n('icu:CustomizingPreferredReactions__title')}
      modalFooter={footer}
    >
      <div
        ref={pickerRef}
        className="module-CustomizingPreferredReactionsModal__small-emoji-picker-wrapper"
      >
        <ReactionPickerPicker
          isSomethingSelected={isSomethingSelected}
          pickerStyle={ReactionPickerPickerStyle.Menu}
        >
          {draftPreferredReactions.map((emoji, index) => {
            return (
              <CustomizingPreferredReactionsModalItem
                // The index is the only thing that uniquely identifies the emoji, because
                //   there can be duplicates in the list.
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                emoji={emoji}
                isSelected={index === selectedDraftEmojiIndex}
                onSelect={() => {
                  selectDraftEmojiToBeReplaced(index);
                }}
                onDeselect={() => {
                  deselectDraftEmoji();
                }}
                onSelectEmoji={emojiSelection => {
                  const emojiVariant = getEmojiVariantByKey(
                    emojiSelection.variantKey
                  );
                  replaceSelectedDraftEmoji(emojiVariant.value);
                }}
              />
            );
          })}
        </ReactionPickerPicker>
        {hadSaveError
          ? i18n('icu:CustomizingPreferredReactions__had-save-error')
          : i18n('icu:CustomizingPreferredReactions__subtitle')}
      </div>
    </Modal>
  );
}

function CustomizingPreferredReactionsModalItem(props: {
  emoji: string;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onSelectEmoji: (emojiSelection: FunEmojiSelection) => void;
}) {
  const { onDeselect } = props;

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const handleEmojiPickerOpenChange = useCallback(
    (open: boolean) => {
      setEmojiPickerOpen(open);
      if (!open) {
        onDeselect();
      }
    },
    [onDeselect]
  );

  return (
    <FunEmojiPicker
      open={emojiPickerOpen}
      onOpenChange={handleEmojiPickerOpenChange}
      placement="bottom"
      onSelectEmoji={props.onSelectEmoji}
      closeOnSelect
    >
      <ReactionPickerPickerEmojiButton
        emoji={props.emoji}
        onClick={props.onSelect}
        isSelected={props.isSelected}
      />
    </FunEmojiPicker>
  );
}
