// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as uuid } from 'uuid';
import { RowType } from '../../../components/ConversationList';
import { FindDirection } from '../../../components/leftPane/LeftPaneHelper';
import * as remoteConfig from '../../../RemoteConfig';

import { LeftPaneComposeHelper } from '../../../components/leftPane/LeftPaneComposeHelper';

describe('LeftPaneComposeHelper', () => {
  const fakeContact = () => ({
    id: uuid(),
    title: uuid(),
    type: 'direct' as const,
  });

  let sinonSandbox: sinon.SinonSandbox;
  let remoteConfigStub: sinon.SinonStub;

  beforeEach(() => {
    sinonSandbox = sinon.createSandbox();

    remoteConfigStub = sinonSandbox
      .stub(remoteConfig, 'isEnabled')
      .withArgs('desktop.storage')
      .returns(true)
      .withArgs('desktop.storageWrite3')
      .returns(true);
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  describe('getBackAction', () => {
    it('returns the "show inbox" action', () => {
      const showInbox = sinon.fake();
      const helper = new LeftPaneComposeHelper({
        composeContacts: [],
        regionCode: 'US',
        searchTerm: '',
      });

      assert.strictEqual(helper.getBackAction({ showInbox }), showInbox);
    });
  });

  describe('getRowCount', () => {
    it('returns 1 (for the "new group" button) if not searching and there are no contacts', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [],
          regionCode: 'US',
          searchTerm: '',
        }).getRowCount(),
        1
      );
    });

    it('returns the number of contacts + 2 (for the "new group" button and header) if not searching', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [fakeContact(), fakeContact()],
          regionCode: 'US',
          searchTerm: '',
        }).getRowCount(),
        4
      );
    });

    it('returns the number of contacts if searching, but not for a phone number', () => {
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
          searchTerm: 'foo bar',
        }).getRowCount(),
        2
      );
    });

    it('returns 1 (for the "Start new conversation" button) if searching for a phone number with no contacts', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [],
          regionCode: 'US',
          searchTerm: '+16505551234',
        }).getRowCount(),
        1
      );
    });

    it('returns the number of contacts + 2 (for the "Start new conversation" button and header) if searching for a phone number', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [fakeContact(), fakeContact()],
          regionCode: 'US',
          searchTerm: '+16505551234',
        }).getRowCount(),
        4
      );
    });
  });

  describe('getRow', () => {
    it('returns a "new group" button if not searching and there are no contacts', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [],
        regionCode: 'US',
        searchTerm: '',
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.CreateNewGroup,
      });
      assert.isUndefined(helper.getRow(1));
    });

    it('returns a "new group" button, a header, and contacts if not searching', () => {
      const composeContacts = [fakeContact(), fakeContact()];
      const helper = new LeftPaneComposeHelper({
        composeContacts,
        regionCode: 'US',
        searchTerm: '',
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.CreateNewGroup,
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Header,
        i18nKey: 'contactsHeader',
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Contact,
        contact: composeContacts[0],
      });
      assert.deepEqual(helper.getRow(3), {
        type: RowType.Contact,
        contact: composeContacts[1],
      });
    });

    it("doesn't let you create new groups if storage service write is disabled", () => {
      remoteConfigStub
        .withArgs('desktop.storage')
        .returns(false)
        .withArgs('desktop.storageWrite3')
        .returns(false);

      assert.isUndefined(
        new LeftPaneComposeHelper({
          composeContacts: [],
          regionCode: 'US',
          searchTerm: '',
        }).getRow(0)
      );

      remoteConfigStub
        .withArgs('desktop.storage')
        .returns(true)
        .withArgs('desktop.storageWrite3')
        .returns(false);

      assert.isUndefined(
        new LeftPaneComposeHelper({
          composeContacts: [],
          regionCode: 'US',
          searchTerm: '',
        }).getRow(0)
      );
    });

    it('returns no rows if searching and there are no results', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [],
        regionCode: 'US',
        searchTerm: 'foo bar',
      });

      assert.isUndefined(helper.getRow(0));
      assert.isUndefined(helper.getRow(1));
    });

    it('returns one row per contact if searching', () => {
      const composeContacts = [fakeContact(), fakeContact()];
      const helper = new LeftPaneComposeHelper({
        composeContacts,
        regionCode: 'US',
        searchTerm: 'foo bar',
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

    it('returns a "start new conversation" row if searching for a phone number and there are no results', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [],
        regionCode: 'US',
        searchTerm: '+16505551234',
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.StartNewConversation,
        phoneNumber: '+16505551234',
      });
      assert.isUndefined(helper.getRow(1));
    });

    it('returns a "start new conversation" row, a header, and contacts if searching for a phone number', () => {
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
        type: RowType.Header,
        i18nKey: 'contactsHeader',
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Contact,
        contact: composeContacts[0],
      });
      assert.deepEqual(helper.getRow(3), {
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
    it('returns false if going from "no header" to "no header"', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [fakeContact(), fakeContact()],
        regionCode: 'US',
        searchTerm: 'foo bar',
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          composeContacts: [fakeContact()],
          regionCode: 'US',
          searchTerm: 'foo bar',
        })
      );
      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          composeContacts: [fakeContact(), fakeContact(), fakeContact()],
          regionCode: 'US',
          searchTerm: 'bing bong',
        })
      );
    });

    it('returns false if going from "has header" to "has header"', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [fakeContact(), fakeContact()],
        regionCode: 'US',
        searchTerm: '',
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          composeContacts: [fakeContact()],
          regionCode: 'US',
          searchTerm: '',
        })
      );
      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          composeContacts: [fakeContact()],
          regionCode: 'US',
          searchTerm: '+16505559876',
        })
      );
    });

    it('returns true if going from "no header" to "has header"', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [fakeContact(), fakeContact()],
        regionCode: 'US',
        searchTerm: 'foo bar',
      });

      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          composeContacts: [fakeContact(), fakeContact()],
          regionCode: 'US',
          searchTerm: '',
        })
      );
      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          composeContacts: [fakeContact(), fakeContact()],
          regionCode: 'US',
          searchTerm: '+16505551234',
        })
      );
    });

    it('returns true if going from "has header" to "no header"', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [fakeContact(), fakeContact()],
        regionCode: 'US',
        searchTerm: '',
      });

      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          composeContacts: [fakeContact(), fakeContact()],
          regionCode: 'US',
          searchTerm: 'foo bar',
        })
      );
    });
  });
});
