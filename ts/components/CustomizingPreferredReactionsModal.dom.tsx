// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useState, useCallback, type JSX, useMemo } from 'react';
import lodash from 'lodash';
import type { LocalizerType } from '../types/Util.std.ts';
import {
  ReactionPickerPicker,
  ReactionPickerPickerEmojiButton,
  ReactionPickerPickerStyle,
} from './ReactionPickerPicker.dom.tsx';
import { FunEmojiPicker } from './fun/FunEmojiPicker.dom.tsx';
import type { FunEmojiSelection } from './fun/panels/FunPanelEmojis.dom.tsx';
import { Emoji } from '../axo/emoji.std.ts';
import { AxoDialog } from '../axo/AxoDialog.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

const { isEqual } = lodash;

export type PropsType = {
  draftPreferredReactions: ReadonlyArray<Emoji.Variant>;
  hadSaveError: boolean;
  i18n: LocalizerType;
  isSaving: boolean;
  originalPreferredReactions: ReadonlyArray<Emoji.Variant>;
  recentEmojis: ReadonlyArray<Emoji.Parent>;
  selectedDraftEmojiIndex: undefined | number;
  emojiSkinToneDefault: Emoji.SkinTone | null;

  cancelCustomizePreferredReactionsModal: () => unknown;
  deselectDraftEmoji: () => unknown;
  onEmojiSkinToneDefaultChange: (emojiSkinToneDefault: Emoji.SkinTone) => void;
  replaceSelectedDraftEmoji: (newEmoji: Emoji.Variant) => unknown;
  resetDraftEmoji: () => unknown;
  savePreferredReactions: () => unknown;
  selectDraftEmojiToBeReplaced: (index: number) => unknown;
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
  const isSomethingSelected = selectedDraftEmojiIndex !== undefined;

  const hasChanged = useMemo(() => {
    return !isEqual(originalPreferredReactions, draftPreferredReactions);
  }, [originalPreferredReactions, draftPreferredReactions]);

  const isDefaults = useMemo(() => {
    return isEqual(
      Emoji.getDefaultPreferredReactionEmojis(
        emojiSkinToneDefault ?? Emoji.SkinTone.None
      ),
      draftPreferredReactions
    );
  }, [emojiSkinToneDefault, draftPreferredReactions]);

  return (
    <AxoDialog.Root open onOpenChange={cancelCustomizePreferredReactionsModal}>
      <AxoDialog.Content size="sm" escape="cancel-is-destructive">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:CustomizingPreferredReactions__title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <div className={tw('flex flex-col items-center py-16')}>
            <ReactionPickerPicker
              isSomethingSelected={isSomethingSelected}
              pickerStyle={ReactionPickerPickerStyle.Menu}
            >
              {draftPreferredReactions.map((emoji, index) => {
                return (
                  <CustomizingPreferredReactionsModalItem
                    // The index is the only thing that uniquely identifies the emoji, because
                    //   there can be duplicates in the list.
                    // oxlint-disable-next-line react/no-array-index-key
                    key={index}
                    emoji={emoji}
                    isSelected={index === selectedDraftEmojiIndex}
                    onSelect={() => {
                      selectDraftEmojiToBeReplaced(index);
                    }}
                    onDeselect={deselectDraftEmoji}
                    onSelectEmoji={emojiSelection => {
                      replaceSelectedDraftEmoji(emojiSelection.emoji);
                    }}
                  />
                );
              })}
            </ReactionPickerPicker>
            <AxoDialog.Description>
              <p
                className={tw(
                  'mt-8 text-center type-body-medium text-pretty text-label-secondary'
                )}
              >
                {hadSaveError
                  ? i18n('icu:CustomizingPreferredReactions__had-save-error')
                  : i18n('icu:CustomizingPreferredReactions__subtitle')}
              </p>
            </AxoDialog.Description>
          </div>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action
              variant="secondary"
              disabled={!isDefaults || isSaving}
              onClick={resetDraftEmoji}
            >
              {i18n('icu:reset')}
            </AxoDialog.Action>
            <AxoDialog.Action
              variant="primary"
              disabled={!hasChanged}
              pending={isSaving}
              onClick={savePreferredReactions}
            >
              {i18n('icu:save')}
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function CustomizingPreferredReactionsModalItem(props: {
  emoji: Emoji.Variant;
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
