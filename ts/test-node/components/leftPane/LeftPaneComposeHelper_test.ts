// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { RowType } from '../../../components/ConversationList';
import { FindDirection } from '../../../components/leftPane/LeftPaneHelper';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

import { LeftPaneComposeHelper } from '../../../components/leftPane/LeftPaneComposeHelper';

describe('LeftPaneComposeHelper', () => {
  let sinonSandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sinonSandbox = sinon.createSandbox();
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
        isUsernamesEnabled: true,
        uuidFetchState: {},
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
          isUsernamesEnabled: true,
          uuidFetchState: {},
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
          isUsernamesEnabled: true,
          uuidFetchState: {},
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
          isUsernamesEnabled: true,
          uuidFetchState: {},
        }).getRowCount(),
        7
      );
    });

    it('returns the number of contacts, number groups + 4 (for headers and username)', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [getDefaultConversation(), getDefaultConversation()],
          regionCode: 'US',
          searchTerm: 'someone',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        }).getRowCount(),
        8
      );
    });

    it('if usernames are disabled, two less rows are shown', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [getDefaultConversation(), getDefaultConversation()],
          regionCode: 'US',
          searchTerm: 'someone',
          isUsernamesEnabled: false,
          uuidFetchState: {},
        }).getRowCount(),
        6
      );
    });

    it('returns the number of conversations + the headers, but not for a phone number', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: 'foo bar',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        }).getRowCount(),
        2
      );
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: 'foo bar',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        }).getRowCount(),
        5
      );
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [getDefaultConversation()],
          regionCode: 'US',
          searchTerm: 'foo bar',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        }).getRowCount(),
        7
      );
    });

    it('returns 2 (for the "Start new conversation" button) if searching for a phone number with no contacts', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: '+16505551234',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        }).getRowCount(),
        2
      );
    });

    it('returns 2 if just username in results', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: 'someone',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        }).getRowCount(),
        2
      );
    });

    it('returns the number of contacts + 2 (for the "Start new conversation" button and header) if searching for a phone number', () => {
      assert.strictEqual(
        new LeftPaneComposeHelper({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: '+16505551234',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        }).getRowCount(),
        5
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
        isUsernamesEnabled: true,
        uuidFetchState: {},
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
        isUsernamesEnabled: true,
        uuidFetchState: {},
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
        isUsernamesEnabled: true,
        uuidFetchState: {},
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

    it('returns no rows if searching, no results, and usernames are disabled', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: 'foo bar',
        isUsernamesEnabled: false,
        uuidFetchState: {},
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
        isUsernamesEnabled: true,
        uuidFetchState: {},
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
        searchTerm: '+1(650) 555 12 34',
        isUsernamesEnabled: true,
        uuidFetchState: {},
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Header,
        i18nKey: 'findByPhoneNumberHeader',
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.StartNewConversation,
        phoneNumber: {
          isValid: true,
          userInput: '+1(650) 555 12 34',
          e164: '+16505551234',
        },
        isFetching: false,
      });
      assert.isUndefined(helper.getRow(2));
    });

    it('returns just a "find by username" header if no results', () => {
      const username = 'someone';

      const helper = new LeftPaneComposeHelper({
        composeContacts: [],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: username,
        isUsernamesEnabled: true,
        uuidFetchState: {
          [`username:${username}`]: true,
        },
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Header,
        i18nKey: 'findByUsernameHeader',
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.UsernameSearchResult,
        username,
        isFetchingUsername: true,
      });
      assert.isUndefined(helper.getRow(2));
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
        searchTerm: '+1(650) 555 12 34',
        isUsernamesEnabled: true,
        uuidFetchState: {},
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Header,
        i18nKey: 'contactsHeader',
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.Contact,
        contact: composeContacts[0],
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.Contact,
        contact: composeContacts[1],
      });
      assert.deepEqual(helper.getRow(3), {
        type: RowType.Header,
        i18nKey: 'findByPhoneNumberHeader',
      });
      assert.deepEqual(helper.getRow(4), {
        type: RowType.StartNewConversation,
        phoneNumber: {
          isValid: true,
          userInput: '+1(650) 555 12 34',
          e164: '+16505551234',
        },
        isFetching: false,
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
        isUsernamesEnabled: true,
        uuidFetchState: {},
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
        isUsernamesEnabled: true,
        uuidFetchState: {},
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
    it('returns false if just search changes, so "Find by username" header is in same position', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: 'foo bar',
        isUsernamesEnabled: true,
        uuidFetchState: {},
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          composeContacts: [],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: 'different search',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        })
      );
      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          composeContacts: [],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: 'last search',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        })
      );
    });

    it('returns true if "Find by usernames" header changes location or goes away', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [getDefaultConversation(), getDefaultConversation()],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: '',
        isUsernamesEnabled: true,
        uuidFetchState: {},
      });

      assert.isFalse(
        helper.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: '',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        })
      );
    });

    it('returns true if search changes or becomes an e164', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [getDefaultConversation(), getDefaultConversation()],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: 'foo bar',
        isUsernamesEnabled: true,
        uuidFetchState: {},
      });

      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: '',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        })
      );
      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: '+16505551234',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        })
      );
    });

    it('returns true if going from no search to some search (showing "Find by username" section)', () => {
      const helper = new LeftPaneComposeHelper({
        composeContacts: [getDefaultConversation(), getDefaultConversation()],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: '',
        isUsernamesEnabled: true,
        uuidFetchState: {},
      });

      assert.isTrue(
        helper.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: 'foo bar',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        })
      );
    });

    it('should be true if going from contact to group or vice versa', () => {
      const helperContacts = new LeftPaneComposeHelper({
        composeContacts: [getDefaultConversation(), getDefaultConversation()],
        composeGroups: [],
        regionCode: 'US',
        searchTerm: 'foo bar',
        isUsernamesEnabled: true,
        uuidFetchState: {},
      });

      assert.isTrue(
        helperContacts.shouldRecomputeRowHeights({
          composeContacts: [],
          composeGroups: [getDefaultConversation(), getDefaultConversation()],
          regionCode: 'US',
          searchTerm: 'foo bar',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        })
      );

      const helperGroups = new LeftPaneComposeHelper({
        composeContacts: [],
        composeGroups: [getDefaultConversation(), getDefaultConversation()],
        regionCode: 'US',
        searchTerm: 'foo bar',
        isUsernamesEnabled: true,
        uuidFetchState: {},
      });

      assert.isTrue(
        helperGroups.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation(), getDefaultConversation()],
          composeGroups: [],
          regionCode: 'US',
          searchTerm: 'foo bar',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        })
      );
    });

    it('should be true if the headers are in different row indices as before', () => {
      const helperContacts = new LeftPaneComposeHelper({
        composeContacts: [getDefaultConversation(), getDefaultConversation()],
        composeGroups: [getDefaultConversation()],
        regionCode: 'US',
        searchTerm: 'soup',
        isUsernamesEnabled: true,
        uuidFetchState: {},
      });

      assert.isTrue(
        helperContacts.shouldRecomputeRowHeights({
          composeContacts: [getDefaultConversation()],
          composeGroups: [getDefaultConversation(), getDefaultConversation()],
          regionCode: 'US',
          searchTerm: 'soup',
          isUsernamesEnabled: true,
          uuidFetchState: {},
        })
      );
    });
  });
});
