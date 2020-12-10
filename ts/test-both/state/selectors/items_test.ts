// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getPinnedConversationIds } from '../../../state/selectors/items';
import type { StateType } from '../../../state/reducer';

describe('both/state/selectors/items', () => {
  describe('#getPinnedConversationIds', () => {
    // Note: we would like to use the full reducer here, to get a real empty state object
    //   but we cannot load the full reducer inside of electron-mocha.
    function getDefaultStateType(): StateType {
      return {
        items: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    }

    it('returns pinnedConversationIds key from items', () => {
      const expected = ['one', 'two'];
      const state: StateType = {
        ...getDefaultStateType(),
        items: {
          pinnedConversationIds: expected,
        },
      };

      const actual = getPinnedConversationIds(state);
      assert.deepEqual(actual, expected);
    });

    it('returns empty array if no saved data', () => {
      const expected: Array<string> = [];
      const state = getDefaultStateType();

      const actual = getPinnedConversationIds(state);
      assert.deepEqual(actual, expected);
    });
  });
});
