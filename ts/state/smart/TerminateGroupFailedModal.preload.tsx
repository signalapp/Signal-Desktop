// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { TerminateGroupFailedModal } from '../../components/TerminateGroupFailedModal.dom.js';
import { getIntl } from '../selectors/user.std.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';

export type SmartTerminateGroupFailedModalProps = {
  conversationId: string;
};

export const SmartTerminateGroupFailedModal = memo(
  function SmartTerminateGroupFailedModal({
    conversationId,
  }: SmartTerminateGroupFailedModalProps) {
    const i18n = useSelector(getIntl);
    const { terminateGroup } = useConversationsActions();
    const { hideTerminateGroupFailedModal } = useGlobalModalActions();

    return (
      <TerminateGroupFailedModal
        i18n={i18n}
        onClose={hideTerminateGroupFailedModal}
        onRetry={() => terminateGroup(conversationId)}
      />
    );
  }
);
