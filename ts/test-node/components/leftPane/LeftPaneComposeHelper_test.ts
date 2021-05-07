// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { RowType } from '../../../components/ConversationList';
import { FindDirection } from '../../../components/leftPane/LeftPaneHelper';
import * as remoteConfig from '../../../RemoteConfig';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

import { LeftPaneComposeHelper } from '../../../components/leftPane/LeftPaneComposeHelper';

describe('LeftPaneComposeHelper', () => {
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
        composeGroups: [],
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
          composeGroups: [],
          regionCode: 'US',
          searchTerm: '',
        }).getRowCount(),
        1
      );
    });

    it('returns the number of contacts + 2 (for the "new group" button and header) if not searching', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: '',
        }).getRowCount(),
        4
      );
    });

    it('returns the number of contacts + number of groups + 3 (for the "new group" button and the headers) if not searching', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [getDefaultConversation(), getDefaultConversation()],
          regionCode: 'US',
          searchTerm: '',
        }).getRowCount(),
        7
      );
    });

    it('returns the number of conversations + the headers, but not for a phone number', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: 'foo bar',
        }).getRowCount(),
        0
      );
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: 'foo bar',
        }).getRowCount(),
        3
      );
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [getDefaultConversation()],
          regionCode: 'US',
          searchTerm: 'foo bar',
        }).getRowCount(),
        5
      );
    });

    it('returns 1 (for the "Start new conversation" button) if searching for a phone number with no contacts', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: '+16505551234',
        }).getRowCount(),
        1
      );
    });

    it('returns the number of contacts + 2 (for the "Start new conversation" button and header) if searching for a phone number', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [],
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
        composeGroups: [],
        regionCode: 'US',
        searchTerm: '',
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.CreateNewGroup,
      });
      assert.isUndefined(helper.getRow(1));
    });

    it('returns a "new group" button, a header, and contacts if not searching', () => {
      const composeContacts = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneComposeHelper({
        composeContacts,
        composeGroups: [],
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

    it('returns a "new group" button, a header, contacts, groups header, and groups -- if not searching', () => {
      const composeContacts = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const composeGroups = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneComposeHelper({
        composeContacts,
        composeGroups,
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
      assert.deepEqual(helper.getRow(4), {
        type: RowType.Header,
        i18nKey: 'groupsHeader',
      });
      assert.deepEqual(helper.getRow(5), {
        type: RowType.Conversation,
        conversation: composeGroups[0],
      });
      assert.deepEqual(helper.getRow(6), {
        type: RowType.Conversation,
        conversation: composeGroups[1],
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
          composeGroups: [],
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
          composeGroups: [],
          regionCode: 'US',
          searchTerm: '',
        }).getRow(0)
      );
    });

    it('returns no rows if searching and there are no results', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: 'foo bar',
      });

      assert.isUndefined(helper.getRow(0));
      assert.isUndefined(helper.getRow(1));
    });

    it('returns one row per contact if searching', () => {
      const composeContacts = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneComposeHelper({
        composeContacts,
        composeGroups: [],
        regionCode: 'US',
        searchTerm: 'foo bar',
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

    it('returns a "start new conversation" row if searching for a phone number and there are no results', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [],
        composeGroups: [],
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
      const composeContacts = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneComposeHelper({
        composeContacts,
        composeGroups: [],
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
        composeContacts: [getDefaultConversation(), getDefaultConversation()],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: 'foo bar',
      });

      assert.isUndefined(helper.getConversationAndMessageAtIndex(0));
    });
  });

  describe('getConversationAndMessageInDirection', () => {
    it('returns undefined because keyboard shortcuts are not supported', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [getDefaultConversation(), getDefaultConversation()],
        composeGroups: [],
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
        composeContacts: [getDefaultConversation(), getDefaultConversation()],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: 'foo bar',
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: 'foo bar',
        })
      );
      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          composeContacts: [
            getDefaultConversation(),
            getDefaultConversation(),
            getDefaultConversation(),
          ],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: 'bing bong',
        })
      );
    });

    it('returns false if going from "has header" to "has header"', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [getDefaultConversation(), getDefaultConversation()],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: '',
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: '',
        })
      );
      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: '+16505559876',
        })
      );
    });

    it('returns true if going from "no header" to "has header"', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [getDefaultConversation(), getDefaultConversation()],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: 'foo bar',
      });

      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: '',
        })
      );
      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: '+16505551234',
        })
      );
    });

    it('returns true if going from "has header" to "no header"', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [getDefaultConversation(), getDefaultConversation()],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: '',
      });

      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: 'foo bar',
        })
      );
    });

    it('should be true if going from contact to group or vice versa', () => {
      const helperContacts = new LeftPaneComposeHelper({
        composeContacts: [getDefaultConversation(), getDefaultConversation()],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: 'foo bar',
      });

      assert.isTrue(
        helperContacts.shouldRecomputeRowHeights({
          composeContacts: [],
          composeGroups: [getDefaultConversation(), getDefaultConversation()],
          regionCode: 'US',
          searchTerm: 'foo bar',
        })
      );

      const helperGroups = new LeftPaneComposeHelper({
        composeContacts: [],
        composeGroups: [getDefaultConversation(), getDefaultConversation()],
        regionCode: 'US',
        searchTerm: 'foo bar',
      });

      assert.isTrue(
        helperGroups.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: 'foo bar',
        })
      );
    });

    it('should be true if the headers are in different row indices as before', () => {
      const helperContacts = new LeftPaneComposeHelper({
        composeContacts: [getDefaultConversation(), getDefaultConversation()],
        composeGroups: [getDefaultConversation()],
        regionCode: 'US',
        searchTerm: 'soup',
      });

      assert.isTrue(
        helperContacts.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation()],
          composeGroups: [getDefaultConversation(), getDefaultConversation()],
          regionCode: 'US',
          searchTerm: 'sandwich',
        })
      );
    });
  });
});
