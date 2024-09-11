// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { CallLinkPendingParticipantModal } from '../../components/CallLinkPendingParticipantModal';
import { useCallingActions } from '../ducks/calling';
import { getIntl } from '../selectors/user';
import { useConversationsActions } from '../ducks/conversations';
import { useGlobalModalActions } from '../ducks/globalModals';
import { getConversationSelector } from '../selectors/conversations';
import { getCallLinkPendingParticipantContactId } from '../selectors/globalModals';
import { strictAssert } from '../../util/assert';

export const SmartCallLinkPendingParticipantModal = memo(
  function SmartCallLinkPendingParticipantModal(): JSX.Element | null {
    const contactId = useSelector(getCallLinkPendingParticipantContactId);
    strictAssert(contactId, 'Expected contactId to be set');

    const i18n = useSelector(getIntl);
    const getConversation = useSelector(getConversationSelector);

    const { updateSharedGroups } = useConversationsActions();
    const { approveUser, denyUser } = useCallingActions();
    const { toggleAboutContactModal, toggleCallLinkPendingParticipantModal } =
      useGlobalModalActions();

    const conversation = getConversation(contactId);

    return (
      <CallLinkPendingParticipantModal
        i18n={i18n}
        conversation={conversation}
        approveUser={approveUser}
        denyUser={denyUser}
        onClose={toggleCallLinkPendingParticipantModal}
        updateSharedGroups={updateSharedGroups}
        toggleAboutContactModal={toggleAboutContactModal}
      />
    );
  }
);
