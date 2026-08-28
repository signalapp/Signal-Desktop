// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useSelector } from 'react-redux';
import { memo, useCallback, useMemo } from 'react';
import { ConversationNotificationsSettings } from '../../components/conversation/conversation-details/ConversationNotificationsSettings.dom.tsx';
import { getIntl } from '../selectors/user.std.ts';
import { getConversationByIdSelector } from '../selectors/conversations.dom.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useNavActions } from '../ducks/nav.std.ts';
import { PanelType } from '../../types/Panels.std.ts';
import { getNotifyWhileMuted } from '../../util/notifyWhileMuted.std.ts';
import { getGlobalNotifyWhileMuted } from '../selectors/items.dom.ts';

export type SmartConversationNotificationsSettingsProps = {
  conversationId: string;
};

export const SmartConversationNotificationsSettings = memo(
  function SmartConversationNotificationsSettings({
    conversationId,
  }: SmartConversationNotificationsSettingsProps) {
    const i18n = useSelector(getIntl);
    const conversationSelector = useSelector(getConversationByIdSelector);
    const { setMuteExpiration } = useConversationsActions();
    const { pushPanelForConversation } = useNavActions();
    const globalNotifyWhileMuted = useSelector(getGlobalNotifyWhileMuted);
    const conversation = conversationSelector(conversationId);
    strictAssert(conversation, 'Expected a conversation to be found');
    const { muteExpiresAt, type: conversationType } = conversation;

    const notifyWhileMuted = useMemo(
      () => getNotifyWhileMuted(conversation, globalNotifyWhileMuted),
      [conversation, globalNotifyWhileMuted]
    );

    const handleOpenWhileMutedSettings = useCallback(() => {
      pushPanelForConversation({ type: PanelType.WhileMuted });
    }, [pushPanelForConversation]);

    return (
      <ConversationNotificationsSettings
        id={conversationId}
        i18n={i18n}
        isGroup={conversationType === 'group'}
        muteExpiresAt={muteExpiresAt}
        notifyWhileMuted={notifyWhileMuted}
        onOpenWhileMutedSettings={handleOpenWhileMutedSettings}
        setMuteExpiration={setMuteExpiration}
      />
    );
  }
);
