// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { strictAssert } from '../../util/assert.std.js';
import { lookupConversationWithoutServiceId } from '../../util/lookupConversationWithoutServiceId.preload.js';
import { getUsernameFromSearch } from '../../util/Username.dom.js';
import { ChooseGroupMembersModal } from '../../components/conversation/conversation-details/AddGroupMembersModal/ChooseGroupMembersModal.dom.js';
import { getIntl, getTheme, getRegionCode } from '../selectors/user.std.js';
import {
  getCandidateContactsForNewGroup,
  getConversationByIdSelector,
  getMe,
} from '../selectors/conversations.dom.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';

export type SmartChooseGroupMembersModalPropsType = Readonly<{
  conversationIdsAlreadyInGroup: Set<string>;
  maxGroupSize: number;
  confirmAdds: () => void;
  onClose: () => void;
  removeSelectedContact: (_: string) => void;
  searchTerm: string;
  selectedConversationIds: ReadonlyArray<string>;
  setSearchTerm: (_: string) => void;
  toggleSelectedContact: (conversationId: string) => void;
}>;

export const SmartChooseGroupMembersModal = memo(
  function SmartChooseGroupMembersModal({
    conversationIdsAlreadyInGroup,
    maxGroupSize,
    confirmAdds,
    onClose,
    removeSelectedContact,
    searchTerm,
    selectedConversationIds,
    setSearchTerm,
    toggleSelectedContact,
  }: SmartChooseGroupMembersModalPropsType) {
    const i18n = useSelector(getIntl);
    const theme = useSelector(getTheme);
    const regionCode = useSelector(getRegionCode);
    const me = useSelector(getMe);
    const conversationSelector = useSelector(getConversationByIdSelector);

    const candidateContacts = useSelector(getCandidateContactsForNewGroup);
    const selectedContacts = selectedConversationIds.map(conversationId => {
      const convo = conversationSelector(conversationId);
      strictAssert(
        convo,
        '<SmartChooseGroupMemberModal> selected conversation not found'
      );
      return convo;
    });

    const { showUserNotFoundModal } = useGlobalModalActions();

    const username = useMemo(() => {
      return getUsernameFromSearch(searchTerm);
    }, [searchTerm]);

    return (
      <ChooseGroupMembersModal
        regionCode={regionCode}
        candidateContacts={candidateContacts}
        confirmAdds={confirmAdds}
        conversationIdsAlreadyInGroup={conversationIdsAlreadyInGroup}
        i18n={i18n}
        maxGroupSize={maxGroupSize}
        onClose={onClose}
        ourE164={me.e164}
        ourUsername={me.username}
        removeSelectedContact={removeSelectedContact}
        searchTerm={searchTerm}
        selectedContacts={selectedContacts}
        setSearchTerm={setSearchTerm}
        theme={theme}
        toggleSelectedContact={toggleSelectedContact}
        lookupConversationWithoutServiceId={lookupConversationWithoutServiceId}
        showUserNotFoundModal={showUserNotFoundModal}
        username={username}
      />
    );
  }
);
