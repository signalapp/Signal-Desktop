// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as uuid } from 'uuid';
import { RowType } from '../../../components/ConversationList';

import { LeftPaneSetGroupMetadataHelper } from '../../../components/leftPane/LeftPaneSetGroupMetadataHelper';

describe('LeftPaneSetGroupMetadataHelper', () => {
  const fakeContact = () => ({
    id: uuid(),
    title: uuid(),
    type: 'direct' as const,
  });

  describe('getBackAction', () => {
    it('returns the "show composer" action if a request is not active', () => {
      const showChooseGroupMembers = sinon.fake();
      const helper = new LeftPaneSetGroupMetadataHelper({
        groupAvatar: undefined,
        groupName: '',
        hasError: false,
        isCreating: false,
        selectedContacts: [],
      });

      assert.strictEqual(
        helper.getBackAction({ showChooseGroupMembers }),
        showChooseGroupMembers
      );
    });

    it("returns undefined (i.e., you can't go back) if a request is active", () => {
      const helper = new LeftPaneSetGroupMetadataHelper({
        groupAvatar: undefined,
        groupName: 'Foo Bar',
        hasError: false,
        isCreating: true,
        selectedContacts: [],
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
          groupAvatar: undefined,
          groupName: '',
          hasError: false,
          isCreating: false,
          selectedContacts: [],
        }).getRowCount(),
        0
      );
    });

    it('returns the number of candidate contacts + 2 if there are any', () => {
      assert.strictEqual(
        new LeftPaneSetGroupMetadataHelper({
          groupAvatar: undefined,
          groupName: '',
          hasError: false,
          isCreating: false,
          selectedContacts: [fakeContact(), fakeContact()],
        }).getRowCount(),
        4
      );
    });
  });

  describe('getRow', () => {
    it('returns undefined if there are no contacts', () => {
      assert.isUndefined(
        new LeftPaneSetGroupMetadataHelper({
          groupAvatar: undefined,
          groupName: '',
          hasError: false,
          isCreating: false,
          selectedContacts: [],
        }).getRow(0)
      );
    });

    it('returns a header, then the contacts, then a blank space if there are contacts', () => {
      const selectedContacts = [fakeContact(), fakeContact()];
      const helper = new LeftPaneSetGroupMetadataHelper({
        groupAvatar: undefined,
        groupName: '',
        hasError: false,
        isCreating: false,
        selectedContacts,
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Header,
        i18nKey: 'setGroupMetadata__members-header',
      });
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
