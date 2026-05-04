// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { reducer as rootReducer } from '../../../state/reducer.preload.ts';
import { noopAction } from '../../../state/ducks/noop.std.ts';
import type { StateType } from '../../../state/reducer.preload.ts';
import type { PreferredReactionsStateType } from '../../../state/ducks/preferredReactions.preload.ts';

import { getIsCustomizingPreferredReactions } from '../../../state/selectors/preferredReactions.std.ts';
import { Emoji } from '../../../axo/emoji.std.ts';

describe('both/state/selectors/preferredReactions', () => {
  const getEmptyRootState = (): StateType =>
    rootReducer(undefined, noopAction('getEmptyRootState'));

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
                Emoji.SPARKLES,
                Emoji.SPARKLE,
                Emoji.FIREWORK_SPARKLER,
                Emoji.SHARK,
                Emoji.SPARKLING_HEART,
                Emoji.PARKING,
              ],
              originalPreferredReactions: [
                Emoji.BLUE_HEART,
                Emoji.getDefaultVariant(Emoji.THUMBS_UP),
                Emoji.getDefaultVariant(Emoji.THUMBS_DOWN),
                Emoji.JOY,
                Emoji.OPEN_MOUTH,
                Emoji.CRY,
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
