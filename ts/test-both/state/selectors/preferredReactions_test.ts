// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { reducer as rootReducer } from '../../../state/reducer';
import { noopAction } from '../../../state/ducks/noop';
import type { StateType } from '../../../state/reducer';
import type { PreferredReactionsStateType } from '../../../state/ducks/preferredReactions';

import { getIsCustomizingPreferredReactions } from '../../../state/selectors/preferredReactions';

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
              draftPreferredReactions: [
                'sparkles',
                'sparkle',
                'sparkler',
                'shark',
                'sparkling_heart',
                'parking',
              ],
              originalPreferredReactions: [
                'blue_heart',
                'thumbsup',
                'thumbsdown',
                'joy',
                'open_mouth',
                'cry',
              ],
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
