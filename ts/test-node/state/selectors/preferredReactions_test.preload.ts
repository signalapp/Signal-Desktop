// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { reducer as rootReducer } from '../../../state/reducer.preload.js';
import { noopAction } from '../../../state/ducks/noop.std.js';
import type { StateType } from '../../../state/reducer.preload.js';
import type { PreferredReactionsStateType } from '../../../state/ducks/preferredReactions.preload.js';

import { getIsCustomizingPreferredReactions } from '../../../state/selectors/preferredReactions.std.js';

describe('both/state/selectors/preferredReactions', () => {
  const getEmptyRootState = (): StateType =>
    rootReducer(undefined, noopAction());

  const getRootState = (preferredReactions: PreferredReactionsStateType) => ({
    ...getEmptyRootState(),
    preferredReactions,
  });

  describe('getIsCustomizingPreferredReactions', () => {
    it('returns false if the modal is closed', () => {
      assert.isFalse(getIsCustomizingPreferredReactions(getEmptyRootState()));
    });

    it('returns true if the modal is open', () => {
      assert.isTrue(
        getIsCustomizingPreferredReactions(
          getRootState({
            customizePreferredReactionsModal: {
              draftPreferredReactions: ['✨', '❇️', '🎇', '🦈', '💖', '🅿️'],
              originalPreferredReactions: ['💙', '👍', '👎', '😂', '😮', '😢'],
              selectedDraftEmojiIndex: undefined,
              isSaving: false as const,
              hadSaveError: false,
            },
          })
        )
      );
    });
  });
});
