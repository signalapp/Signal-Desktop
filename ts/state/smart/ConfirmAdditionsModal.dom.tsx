// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { strictAssert } from '../../util/assert.std.js';
import { ConfirmAdditionsModal } from '../../components/conversation/conversation-details/AddGroupMembersModal/ConfirmAdditionsModal.dom.js';
import type { RequestState } from '../../components/conversation/conversation-details/util.std.js';
import { getIntl } from '../selectors/user.std.js';
import { getConversationByIdSelector } from '../selectors/conversations.dom.js';

export type SmartConfirmAdditionsModalPropsType = {
  selectedConversationIds: ReadonlyArray<string>;
  groupTitle: string;
  makeRequest: () => void;
  onClose: () => void;
  requestState: RequestState;
};

export const SmartConfirmAdditionsModal = memo(
  function SmartConfirmAdditionsModal({
    selectedConversationIds,
    groupTitle,
    makeRequest,
    onClose,
    requestState,
  }: SmartConfirmAdditionsModalPropsType) {
    const i18n = useSelector(getIntl);
    const conversationSelector = useSelector(getConversationByIdSelector);

    const selectedContacts = useMemo(() => {
      return selectedConversationIds.map(conversationId => {
        const convo = conversationSelector(conversationId);
        strictAssert(
          convo,
          '<SmartChooseGroupMemberModal> selected conversation not found'
        );
        return convo;
      });
    }, [conversationSelector, selectedConversationIds]);

    return (
      <ConfirmAdditionsModal
        i18n={i18n}
        selectedContacts={selectedContacts}
        groupTitle={groupTitle}
        makeRequest={makeRequest}
        onClose={onClose}
        requestState={requestState}
      />
    );
  }
);
