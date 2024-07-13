// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { times } from 'lodash';
import { RowType, _testHeaderText } from '../../../components/ConversationList';
import { ContactCheckboxDisabledReason } from '../../../components/conversationList/ContactCheckbox';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

import { LeftPaneChooseGroupMembersHelper } from '../../../components/leftPane/LeftPaneChooseGroupMembersHelper';

describe('LeftPaneChooseGroupMembersHelper', () => {
  const defaults = {
    uuidFetchState: {},
    candidateContacts: [],
    isShowingRecommendedGroupSizeModal: false,
    isShowingMaximumGroupSizeModal: false,
    ourE164: undefined,
    ourUsername: undefined,
    groupSizeRecommendedLimit: 22,
    groupSizeHardLimit: 33,
    searchTerm: '',
    username: undefined,
    regionCode: 'US',
    selectedContacts: [],
  };

  describe('getBackAction', () => {
    it('returns the "show composer" action', () => {
      const startComposing = sinon.fake();
      const helper = new LeftPaneChooseGroupMembersHelper(defaults);

      assert.strictEqual(
        helper.getBackAction({ startComposing }),
        startComposing
      );
    });
  });

  describe('getRowCount', () => {
    it('returns 0 if there are no contacts', () => {
      assert.strictEqual(
        new LeftPaneChooseGroupMembersHelper({
          ...defaults,
          candidateContacts: [],
          searchTerm: '',
          username: undefined,
          selectedContacts: [getDefaultConversation()],
        }).getRowCount(),
        0
      );
      assert.strictEqual(
        new LeftPaneChooseGroupMembersHelper({
          ...defaults,
          candidateContacts: [],
          searchTerm: 'foo bar',
          username: undefined,
          selectedContacts: [getDefaultConversation()],
        }).getRowCount(),
        0
      );
    });

    it('returns the number of candidate contacts + 2 if there are any', () => {
      assert.strictEqual(
        new LeftPaneChooseGroupMembersHelper({
          ...defaults,
          candidateContacts: [
            getDefaultConversation(),
            getDefaultConversation(),
          ],
          searchTerm: '',
          username: undefined,
          selectedContacts: [getDefaultConversation()],
        }).getRowCount(),
        4
      );
    });
  });

  describe('getRow', () => {
    it('returns undefined if there are no contacts', () => {
      assert.isUndefined(
        new LeftPaneChooseGroupMembersHelper({
          ...defaults,
          candidateContacts: [],
          searchTerm: '',
          username: undefined,
          selectedContacts: [getDefaultConversation()],
        }).getRow(0)
      );
      assert.isUndefined(
        new LeftPaneChooseGroupMembersHelper({
          ...defaults,
          candidateContacts: [],
          searchTerm: '',
          username: undefined,
          selectedContacts: [getDefaultConversation()],
        }).getRow(99)
      );
      assert.isUndefined(
        new LeftPaneChooseGroupMembersHelper({
          ...defaults,
          candidateContacts: [],
          searchTerm: 'foo bar',
          username: undefined,
          selectedContacts: [getDefaultConversation()],
        }).getRow(0)
      );
    });

    it('returns a header, then the contacts, then a blank space if there are contacts', () => {
      const candidateContacts = [
        getDefaultConversation(),
        getDefaultConversation(),
      ];
      const helper = new LeftPaneChooseGroupMembersHelper({
        ...defaults,
        candidateContacts,
        searchTerm: 'foo bar',
        username: undefined,
        selectedContacts: [candidateContacts[1]],
      });

      assert.deepEqual(_testHeaderText(helper.getRow(0)), 'icu:contactsHeader');
      assert.deepEqual(helper.getRow(1), {
        type: RowType.ContactCheckbox,
        contact: candidateContacts[0],
        isChecked: false,
        disabledReason: undefined,
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.ContactCheckbox,
        contact: candidateContacts[1],
        isChecked: true,
        disabledReason: undefined,
      });
      assert.deepEqual(helper.getRow(3), { type: RowType.Blank });
    });

    it("disables non-selected contact checkboxes if you've selected the maximum number of contacts", () => {
      const candidateContacts = times(50, () => getDefaultConversation());
      const helper = new LeftPaneChooseGroupMembersHelper({
        ...defaults,
        candidateContacts,
        searchTerm: 'foo bar',
        username: undefined,
        selectedContacts: candidateContacts.slice(1, 33),
      });

      assert.deepEqual(helper.getRow(1), {
        type: RowType.ContactCheckbox,
        contact: candidateContacts[0],
        isChecked: false,
        disabledReason: ContactCheckboxDisabledReason.MaximumContactsSelected,
      });
      assert.deepEqual(helper.getRow(2), {
        type: RowType.ContactCheckbox,
        contact: candidateContacts[1],
        isChecked: true,
        disabledReason: undefined,
      });
    });

    it('returns a header, then the phone number, then a blank space if there are contacts', () => {
      const helper = new LeftPaneChooseGroupMembersHelper({
        ...defaults,
        candidateContacts: [],
        searchTerm: '212 555',
        username: undefined,
        selectedContacts: [],
      });

      assert.deepEqual(
        _testHeaderText(helper.getRow(0)),
        'icu:findByPhoneNumberHeader'
      );
      assert.deepEqual(helper.getRow(1), {
        type: RowType.PhoneNumberCheckbox,
        phoneNumber: {
          isValid: false,
          userInput: '212 555',
          e164: '+1212555',
        },
        isChecked: false,
        isFetching: false,
      });
      assert.deepEqual(helper.getRow(2), { type: RowType.Blank });
    });

    it('returns a header, then the username, then a blank space if there are contacts', () => {
      const helper = new LeftPaneChooseGroupMembersHelper({
        ...defaults,
        candidateContacts: [],
        searchTerm: 'signal.01',
        username: 'signal.01',
        selectedContacts: [],
      });

      assert.deepEqual(
        _testHeaderText(helper.getRow(0)),
        'icu:findByUsernameHeader'
      );
      assert.deepEqual(helper.getRow(1), {
        type: RowType.UsernameCheckbox,
        username: 'signal.01',
        isChecked: false,
        isFetching: false,
      });
      assert.deepEqual(helper.getRow(2), { type: RowType.Blank });
    });
  });
});
