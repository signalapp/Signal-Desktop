// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useSelector } from 'react-redux';
import { memo, useCallback, useMemo } from 'react';
import { WhileMutedSettings } from '../../components/conversation/conversation-details/WhileMutedSettings.dom.tsx';
import { getIntl } from '../selectors/user.std.ts';
import { getConversationByIdSelector } from '../selectors/conversations.dom.ts';
import { getGlobalNotifyWhileMuted } from '../selectors/items.dom.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import {
  getNotifyWhileMuted,
  type NotifyWhileMutedKey,
} from '../../util/notifyWhileMuted.std.ts';

export type SmartWhileMutedSettingsProps = {
  conversationId: string;
};

export const SmartWhileMutedSettings = memo(function SmartWhileMutedSettings({
  conversationId,
}: SmartWhileMutedSettingsProps) {
  const i18n = useSelector(getIntl);
  const conversationSelector = useSelector(getConversationByIdSelector);
  const { setNotifyWhileMuted } = useConversationsActions();
  const globalNotifyWhileMuted = useSelector(getGlobalNotifyWhileMuted);
  const conversation = conversationSelector(conversationId);
  strictAssert(conversation, 'Expected a conversation to be found');

  const notifyWhileMuted = useMemo(
    () => getNotifyWhileMuted(conversation, globalNotifyWhileMuted),
    [conversation, globalNotifyWhileMuted]
  );
  const setNotifyWhileMutedForConversation = useCallback(
    (key: NotifyWhileMutedKey, value: boolean) =>
      setNotifyWhileMuted(conversationId, key, value),
    [conversationId, setNotifyWhileMuted]
  );

  return (
    <WhileMutedSettings
      i18n={i18n}
      isGroup={conversation.type === 'group'}
      notifyWhileMuted={notifyWhileMuted}
      setNotifyWhileMuted={setNotifyWhileMutedForConversation}
    />
  );
});
