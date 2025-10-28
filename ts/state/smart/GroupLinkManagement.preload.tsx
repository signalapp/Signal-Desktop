// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { GroupLinkManagement } from '../../components/conversation/conversation-details/GroupLinkManagement.dom.js';
import { getConversationSelector } from '../selectors/conversations.dom.js';
import { getIntl } from '../selectors/user.std.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';

export type SmartGroupLinkManagementProps = Readonly<{
  conversationId: string;
}>;

export const SmartGroupLinkManagement = memo(function SmartGroupLinkManagement({
  conversationId,
}: SmartGroupLinkManagementProps) {
  const i18n = useSelector(getIntl);
  const conversationSelector = useSelector(getConversationSelector);
  const conversation = conversationSelector(conversationId);
  const isAdmin = conversation?.areWeAdmin ?? false;
  const {
    changeHasGroupLink,
    generateNewGroupLink,
    setAccessControlAddFromInviteLinkSetting,
  } = useConversationsActions();
  return (
    <GroupLinkManagement
      i18n={i18n}
      changeHasGroupLink={changeHasGroupLink}
      conversation={conversation}
      generateNewGroupLink={generateNewGroupLink}
      isAdmin={isAdmin}
      setAccessControlAddFromInviteLinkSetting={
        setAccessControlAddFromInviteLinkSetting
      }
    />
  );
});
