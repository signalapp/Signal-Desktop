// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useSelector } from 'react-redux';
import React, { memo } from 'react';
import { ConversationNotificationsSettings } from '../../components/conversation/conversation-details/ConversationNotificationsSettings.js';
import { getIntl } from '../selectors/user.js';
import { getConversationByIdSelector } from '../selectors/conversations.js';
import { strictAssert } from '../../util/assert.js';
import { useConversationsActions } from '../ducks/conversations.js';

export type SmartConversationNotificationsSettingsProps = {
  conversationId: string;
};

export const SmartConversationNotificationsSettings = memo(
  function SmartConversationNotificationsSettings({
    conversationId,
  }: SmartConversationNotificationsSettingsProps) {
    const i18n = useSelector(getIntl);
    const conversationSelector = useSelector(getConversationByIdSelector);
    const { setMuteExpiration, setDontNotifyForMentionsIfMuted } =
      useConversationsActions();
    const conversation = conversationSelector(conversationId);
    strictAssert(conversation, 'Expected a conversation to be found');
    const {
      type: conversationType,
      dontNotifyForMentionsIfMuted,
      muteExpiresAt,
    } = conversation;
    return (
      <ConversationNotificationsSettings
        id={conversationId}
        conversationType={conversationType}
        dontNotifyForMentionsIfMuted={dontNotifyForMentionsIfMuted ?? false}
        i18n={i18n}
        muteExpiresAt={muteExpiresAt}
        setMuteExpiration={setMuteExpiration}
        setDontNotifyForMentionsIfMuted={setDontNotifyForMentionsIfMuted}
      />
    );
  }
);
