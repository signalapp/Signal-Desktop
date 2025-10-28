// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import {
  RowType,
  _testHeaderText,
} from '../../../components/ConversationList.dom.js';
import { getDefaultConversation } from '../../../test-helpers/getDefaultConversation.std.js';
import { DurationInSeconds } from '../../../util/durations/index.std.js';

import { LeftPaneSetGroupMetadataHelper } from '../../../components/leftPane/LeftPaneSetGroupMetadataHelper.dom.js';

function getComposeState() {
  return {
    groupAvatar: undefined,
    groupExpireTimer: DurationInSeconds.ZERO,
    groupName: '',
    hasError: false,
    isCreating: false,
    isEditingAvatar: false,
    selectedContacts: [],
    userAvatarData: [],
  };
}

describe('LeftPaneSetGroupMetadataHelper', () => {
  describe('getBackAction', () => {
    it('returns the "show composer" action if a request is not active', () => {
      const showChooseGroupMembers = sinon.fake();
      const helper = new LeftPaneSetGroupMetadataHelper({
        ...getComposeState(),
      });

      assert.strictEqual(
        helper.getBackAction({ showChooseGroupMembers }),
        showChooseGroupMembers
      );
    });

    it("returns undefined (i.e., you can't go back) if a request is active", () => {
      const helper = new LeftPaneSetGroupMetadataHelper({
        ...getComposeState(),
        groupName: 'Foo Bar',
        isCreating: true,
      });

      assert.isUndefined(
        helper.getBackAction({ showChooseGroupMembers: sinon.fake() })
      );
    });
  });

  describe('getRowCount', () => {
    it('returns 0 if there are no contacts', () => {
      assert.strictEqual(
        new LeftPaneSetGroupMetadataHelper({
          ...getComposeState(),
        }).getRowCount(),
        0
      );
    });

    it('returns the number of candidate contacts + 2 if there are any', () => {
      assert.strictEqual(
        new LeftPaneSetGroupMetadataHelper({
          ...getComposeState(),
          selectedContacts: [
            getDefaultConversation(),
            getDefaultConversation(),
          ],
        }).getRowCount(),
        4
      );
    });
  });

  describe('getRow', () => {
    it('returns undefined if there are no contacts', () => {
      assert.isUndefined(
        new LeftPaneSetGroupMetadataHelper({
          ...getComposeState(),
        }).getRow(0)
      );
    });

    it('returns a header, then the contacts, then a blank space if there are contacts', () => {
      const selectedContacts = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneSetGroupMetadataHelper({
        ...getComposeState(),
        selectedContacts,
      });

      assert.deepEqual(
        _testHeaderText(helper.getRow(0)),
        'icu:setGroupMetadata__members-header'
      );
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Contact,
        contact: selectedContacts[0],
        isClickable: false,
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Contact,
        contact: selectedContacts[1],
        isClickable: false,
      });
      assert.deepEqual(helper.getRow(3), { type: RowType.Blank });
    });
  });
});
