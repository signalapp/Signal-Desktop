// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';

import { ConversationDetailsMembershipList } from '../../components/conversation/conversation-details/ConversationDetailsMembershipList';
import { assertDev } from '../../util/assert';
import { getGroupMemberships } from '../../util/getGroupMemberships';
import {
  getConversationByIdSelector,
  getConversationByServiceIdSelector,
} from '../selectors/conversations';
import { getIntl, getTheme } from '../selectors/user';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { useGlobalModalActions } from '../ducks/globalModals';

export type PropsType = {
  conversationId: string;
};

export const SmartGV1Members = memo(function SmartGV1Members({
  conversationId,
}: PropsType): JSX.Element {
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const { showContactModal } = useGlobalModalActions();

  const conversationSelector = useSelector(getConversationByIdSelector);
  const conversationByServiceIdSelector = useSelector(
    getConversationByServiceIdSelector
  );

  const conversation = conversationSelector(conversationId);
  assertDev(
    conversation,
    '<SmartPendingInvites> expected a conversation to be found'
  );

  const { memberships } = getGroupMemberships(
    conversation,
    conversationByServiceIdSelector
  );

  return (
    <ConversationDetailsMembershipList
      canAddNewMembers={false}
      conversationId={conversationId}
      i18n={i18n}
      getPreferredBadge={getPreferredBadge}
      maxShownMemberCount={32}
      memberships={memberships}
      showContactModal={showContactModal}
      theme={theme}
    />
  );
});
