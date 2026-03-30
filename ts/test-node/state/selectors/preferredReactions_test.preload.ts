// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { reducer as rootReducer } from '../../../state/reducer.preload.ts';
import { noopAction } from '../../../state/ducks/noop.std.ts';
import type { StateType } from '../../../state/reducer.preload.ts';
import type { PreferredReactionsStateType } from '../../../state/ducks/preferredReactions.preload.ts';

import { getIsCustomizingPreferredReactions } from '../../../state/selectors/preferredReactions.std.ts';

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
