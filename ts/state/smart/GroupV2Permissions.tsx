// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useSelector } from 'react-redux';
import React, { memo } from 'react';
import { GroupV2Permissions } from '../../components/conversation/conversation-details/GroupV2Permissions';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl } from '../selectors/user';
import { useConversationsActions } from '../ducks/conversations';

export type SmartGroupV2PermissionsProps = {
  conversationId: string;
};

export const SmartGroupV2Permissions = memo(function SmartGroupV2Permissions({
  conversationId,
}: SmartGroupV2PermissionsProps) {
  const i18n = useSelector(getIntl);
  const conversationSelector = useSelector(getConversationSelector);
  const conversation = conversationSelector(conversationId);
  const {
    setAccessControlAttributesSetting,
    setAccessControlMembersSetting,
    setAnnouncementsOnly,
  } = useConversationsActions();
  return (
    <GroupV2Permissions
      i18n={i18n}
      conversation={conversation}
      setAccessControlAttributesSetting={setAccessControlAttributesSetting}
      setAccessControlMembersSetting={setAccessControlMembersSetting}
      setAnnouncementsOnly={setAnnouncementsOnly}
    />
  );
});
