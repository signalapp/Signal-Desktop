// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { CallLinkPendingParticipantModal } from '../../components/CallLinkPendingParticipantModal.dom.tsx';
import { useCallingActions } from '../ducks/calling.preload.ts';
import { getIntl } from '../selectors/user.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { getConversationSelector } from '../selectors/conversations.dom.ts';
import { useSharedGroupNamesOnMount } from '../../util/sharedGroupNames.dom.ts';
import { getCallLinkPendingParticipantContactId } from '../selectors/globalModals.std.ts';
import { strictAssert } from '../../util/assert.std.ts';

export const SmartCallLinkPendingParticipantModal = memo(
  function SmartCallLinkPendingParticipantModal(): React.JSX.Element | null {
    const contactId = useSelector(getCallLinkPendingParticipantContactId);
    strictAssert(contactId, 'Expected contactId to be set');

    const i18n = useSelector(getIntl);
    const getConversation = useSelector(getConversationSelector);
    const sharedGroupNames = useSharedGroupNamesOnMount(contactId);

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
        sharedGroupNames={sharedGroupNames}
        toggleAboutContactModal={toggleAboutContactModal}
      />
    );
  }
);
