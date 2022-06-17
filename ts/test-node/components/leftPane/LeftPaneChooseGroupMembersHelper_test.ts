// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { times } from 'lodash';
import { RowType } from '../../../components/ConversationList';
import { ContactCheckboxDisabledReason } from '../../../components/conversationList/ContactCheckbox';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

import { LeftPaneChooseGroupMembersHelper } from '../../../components/leftPane/LeftPaneChooseGroupMembersHelper';
import { updateRemoteConfig } from '../../../test-both/helpers/RemoteConfigStub';

describe('LeftPaneChooseGroupMembersHelper', () => {
  const defaults = {
    uuidFetchState: {},
    candidateContacts: [],
    isShowingRecommendedGroupSizeModal: false,
    isShowingMaximumGroupSizeModal: false,
    isUsernamesEnabled: true,
    searchTerm: '',
    regionCode: 'US',
    selectedContacts: [],
  };

  beforeEach(async () => {
    await updateRemoteConfig([
      { name: 'global.groupsv2.maxGroupSize', value: '22', enabled: true },
      {
        name: 'global.groupsv2.groupSizeHardLimit',
        value: '33',
        enabled: true,
      },
    ]);
  });

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
          selectedContacts: [getDefaultConversation()],
        }).getRowCount(),
        0
      );
      assert.strictEqual(
        new LeftPaneChooseGroupMembersHelper({
          ...defaults,
          candidateContacts: [],
          searchTerm: 'foo bar',
          selectedContacts: [getDefaultConversation()],
          isUsernamesEnabled: false,
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
          selectedContacts: [getDefaultConversation()],
        }).getRow(0)
      );
      assert.isUndefined(
        new LeftPaneChooseGroupMembersHelper({
          ...defaults,
          candidateContacts: [],
          searchTerm: '',
          selectedContacts: [getDefaultConversation()],
        }).getRow(99)
      );
      assert.isUndefined(
        new LeftPaneChooseGroupMembersHelper({
          ...defaults,
          candidateContacts: [],
          searchTerm: 'foo bar',
          selectedContacts: [getDefaultConversation()],
          isUsernamesEnabled: false,
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
        isUsernamesEnabled: false,
        selectedContacts: [candidateContacts[1]],
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Header,
        i18nKey: 'contactsHeader',
      });
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
        selectedContacts: [],
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Header,
        i18nKey: 'findByPhoneNumberHeader',
      });
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
        searchTerm: 'signal',
        selectedContacts: [],
      });

      assert.deepEqual(helper.getRow(0), {
        type: RowType.Header,
        i18nKey: 'findByUsernameHeader',
      });
      assert.deepEqual(helper.getRow(1), {
        type: RowType.UsernameCheckbox,
        username: 'signal',
        isChecked: false,
        isFetching: false,
      });
      assert.deepEqual(helper.getRow(2), { type: RowType.Blank });
    });
  });
});
