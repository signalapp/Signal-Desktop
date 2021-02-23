// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as uuid } from 'uuid';
import { RowType } from '../../../components/ConversationList';
import { FindDirection } from '../../../components/leftPane/LeftPaneHelper';

import { LeftPaneComposeHelper } from '../../../components/leftPane/LeftPaneComposeHelper';

describe('LeftPaneComposeHelper', () => {
  const fakeContact = () => ({
    id: uuid(),
    title: uuid(),
    type: 'direct' as const,
  });

  describe('getRowCount', () => {
    it('returns the number of contacts if not searching for a phone number', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [],
          regionCode: 'US',
          searchTerm: 'foo bar',
        }).getRowCount(),
        0
      );
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [fakeContact(), fakeContact()],
          regionCode: 'US',
          searchTerm: '',
        }).getRowCount(),
        2
      );
    });

    it('returns the number of contacts + 1 if searching for a phone number', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [fakeContact(), fakeContact()],
          regionCode: 'US',
          searchTerm: '+16505551234',
        }).getRowCount(),
        3
      );
    });
  });

  describe('getRow', () => {
    it('returns each contact as a row if not searching for a phone number', () => {
      const composeContacts = [fakeContact(), fakeContact()];
      const helper = new LeftPaneComposeHelper({
        composeContacts,
        regionCode: 'US',
        searchTerm: '',
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Contact,
        contact: composeContacts[0],
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Contact,
        contact: composeContacts[1],
      });
    });

    it('returns a "start new conversation" row if searching for a phone number', () => {
      const composeContacts = [fakeContact(), fakeContact()];
      const helper = new LeftPaneComposeHelper({
        composeContacts,
        regionCode: 'US',
        searchTerm: '+16505551234',
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.StartNewConversation,
        phoneNumber: '+16505551234',
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Contact,
        contact: composeContacts[0],
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Contact,
        contact: composeContacts[1],
      });
    });
  });

  describe('getConversationAndMessageAtIndex', () => {
    it('returns undefined because keyboard shortcuts are not supported', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [fakeContact(), fakeContact()],
        regionCode: 'US',
        searchTerm: 'foo bar',
      });

      assert.isUndefined(helper.getConversationAndMessageAtIndex(0));
    });
  });

  describe('getConversationAndMessageInDirection', () => {
    it('returns undefined because keyboard shortcuts are not supported', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [fakeContact(), fakeContact()],
        regionCode: 'US',
        searchTerm: 'foo bar',
      });

      assert.isUndefined(
        helper.getConversationAndMessageInDirection(
          { direction: FindDirection.Down, unreadOnly: false },
          undefined,
          undefined
        )
      );
    });
  });

  describe('shouldRecomputeRowHeights', () => {
    it('always returns false because row heights are constant', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [fakeContact(), fakeContact()],
        regionCode: 'US',
        searchTerm: 'foo bar',
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          composeContacts: [fakeContact()],
          searchTerm: 'foo bar',
        })
      );
      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          composeContacts: [fakeContact(), fakeContact(), fakeContact()],
          searchTerm: '',
        })
      );
    });
  });
});
