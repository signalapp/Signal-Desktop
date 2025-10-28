// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { usePreferredReactionsActions } from '../ducks/preferredReactions.preload.js';
import { useItemsActions } from '../ducks/items.preload.js';
import { getIntl } from '../selectors/user.std.js';
import { getEmojiSkinToneDefault } from '../selectors/items.dom.js';
import { useRecentEmojis } from '../selectors/emojis.std.js';
import { getCustomizeModalState } from '../selectors/preferredReactions.std.js';
import { CustomizingPreferredReactionsModal } from '../../components/CustomizingPreferredReactionsModal.dom.js';
import { strictAssert } from '../../util/assert.std.js';

export const SmartCustomizingPreferredReactionsModal = memo(
  function SmartCustomizingPreferredReactionsModal(): JSX.Element {
    const i18n = useSelector(getIntl);
    const customizeModalState = useSelector(getCustomizeModalState);
    const emojiSkinToneDefault = useSelector(getEmojiSkinToneDefault);
    const recentEmojis = useRecentEmojis();

    const {
      cancelCustomizePreferredReactionsModal,
      deselectDraftEmoji,
      replaceSelectedDraftEmoji,
      resetDraftEmoji,
      savePreferredReactions,
      selectDraftEmojiToBeReplaced,
    } = usePreferredReactionsActions();
    const { setEmojiSkinToneDefault } = useItemsActions();

    strictAssert(
      customizeModalState != null,
      '<SmartCustomizingPreferredReactionsModal> requires a modal'
    );

    const {
      hadSaveError,
      isSaving,
      draftPreferredReactions,
      originalPreferredReactions,
      selectedDraftEmojiIndex,
    } = customizeModalState;

    return (
      <CustomizingPreferredReactionsModal
        cancelCustomizePreferredReactionsModal={
          cancelCustomizePreferredReactionsModal
        }
        deselectDraftEmoji={deselectDraftEmoji}
        draftPreferredReactions={draftPreferredReactions}
        hadSaveError={hadSaveError}
        i18n={i18n}
        isSaving={isSaving}
        onEmojiSkinToneDefaultChange={setEmojiSkinToneDefault}
        originalPreferredReactions={originalPreferredReactions}
        recentEmojis={recentEmojis}
        replaceSelectedDraftEmoji={replaceSelectedDraftEmoji}
        resetDraftEmoji={resetDraftEmoji}
        savePreferredReactions={savePreferredReactions}
        selectDraftEmojiToBeReplaced={selectDraftEmojiToBeReplaced}
        selectedDraftEmojiIndex={selectedDraftEmojiIndex}
        emojiSkinToneDefault={emojiSkinToneDefault}
      />
    );
  }
);
