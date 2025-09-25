// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { usePreferredReactionsActions } from '../ducks/preferredReactions.js';
import { useItemsActions } from '../ducks/items.js';
import { getIntl } from '../selectors/user.js';
import { getEmojiSkinToneDefault } from '../selectors/items.js';
import { useRecentEmojis } from '../selectors/emojis.js';
import { getCustomizeModalState } from '../selectors/preferredReactions.js';
import { CustomizingPreferredReactionsModal } from '../../components/CustomizingPreferredReactionsModal.js';
import { strictAssert } from '../../util/assert.js';

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
