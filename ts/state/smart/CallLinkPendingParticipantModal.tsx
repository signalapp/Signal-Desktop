// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { CallLinkPendingParticipantModal } from '../../components/CallLinkPendingParticipantModal.dom.js';
import { useCallingActions } from '../ducks/calling.preload.js';
import { getIntl } from '../selectors/user.std.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { getConversationSelector } from '../selectors/conversations.dom.js';
import { getCallLinkPendingParticipantContactId } from '../selectors/globalModals.std.js';
import { strictAssert } from '../../util/assert.std.js';

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
