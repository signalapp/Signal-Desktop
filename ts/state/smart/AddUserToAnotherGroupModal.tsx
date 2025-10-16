// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useSelector } from 'react-redux';
import React, { memo } from 'react';
import { AddUserToAnotherGroupModal } from '../../components/AddUserToAnotherGroupModal.dom.js';
import {
  getAllGroupsWithInviteAccess,
  getContactSelector,
} from '../selectors/conversations.dom.js';
import { getIntl, getRegionCode } from '../selectors/user.std.js';
import { useToastActions } from '../ducks/toast.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';

export type SmartAddUserToAnotherGroupModalProps = Readonly<{
  contactID: string;
}>;

export const SmartAddUserToAnotherGroupModal = memo(
  function SmartAddUserToAnotherGroupModal({
    contactID,
  }: SmartAddUserToAnotherGroupModalProps) {
    const i18n = useSelector(getIntl);
    const candidateConversations = useSelector(getAllGroupsWithInviteAccess);
    const getContact = useSelector(getContactSelector);
    const regionCode = useSelector(getRegionCode);

    const { toggleAddUserToAnotherGroupModal } = useGlobalModalActions();
    const { addMembersToGroup } = useConversationsActions();
    const { showToast } = useToastActions();

    const contact = getContact(contactID);

    return (
      <AddUserToAnotherGroupModal
        contact={contact}
        i18n={i18n}
        candidateConversations={candidateConversations}
        regionCode={regionCode}
        toggleAddUserToAnotherGroupModal={toggleAddUserToAnotherGroupModal}
        addMembersToGroup={addMembersToGroup}
        showToast={showToast}
      />
    );
  }
);
