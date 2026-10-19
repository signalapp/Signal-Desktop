// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { useSelector } from 'react-redux';
import { PreferencesBlocked } from '../../components/preferences/PreferencesBlocked.dom.tsx';
import { getIntl, getTheme } from '../selectors/user.std.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { getAllUnblockedConversations } from '../selectors/conversations.dom.ts';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
import {
  getBlockedContacts,
  getBlockedGroups,
} from '../selectors/blocked.dom.ts';

export type SmartPreferencesBlockedProps = Readonly<{
  goBack: () => void;
}>;

export function SmartPreferencesBlocked(
  props: SmartPreferencesBlockedProps
): JSX.Element {
  const i18n = useSelector(getIntl);
  const { acceptConversation: onUnblock, blockConversation: onBlock } =
    useConversationsActions();
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const theme = useSelector(getTheme);

  const blockedContacts = useSelector(getBlockedContacts);
  const blockedGroups = useSelector(getBlockedGroups);
  const conversationNotBlocked = useSelector(getAllUnblockedConversations);

  return (
    <PreferencesBlocked
      i18n={i18n}
      goBack={props.goBack}
      blockedContacts={blockedContacts}
      blockedGroups={blockedGroups}
      conversationsNotBlocked={conversationNotBlocked}
      getPreferredBadge={getPreferredBadge}
      onBlock={onBlock}
      onUnblock={onUnblock}
      theme={theme}
    />
  );
}
