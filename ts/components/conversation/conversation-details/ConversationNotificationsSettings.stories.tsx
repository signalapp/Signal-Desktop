// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import type { PropsType } from './ConversationNotificationsSettings';
import { ConversationNotificationsSettings } from './ConversationNotificationsSettings';

const i18n = setupI18n('en', enMessages);

export default {
  title:
    'Components/Conversation/ConversationDetails/ConversationNotificationsSettings',
} satisfies Meta<PropsType>;

const getCommonProps = () => ({
  id: 'conversation-id',
  muteExpiresAt: undefined,
  conversationType: 'group' as const,
  dontNotifyForMentionsIfMuted: false,
  i18n,
  setDontNotifyForMentionsIfMuted: action('setDontNotifyForMentionsIfMuted'),
  setMuteExpiration: action('setMuteExpiration'),
});

export function GroupConversationAllDefault(): JSX.Element {
  return <ConversationNotificationsSettings {...getCommonProps()} />;
}

export function GroupConversationMuted(): JSX.Element {
  return (
    <ConversationNotificationsSettings
      {...getCommonProps()}
      muteExpiresAt={Date.UTC(2099, 5, 9)}
    />
  );
}

export function GroupConversationMentionsMuted(): JSX.Element {
  return (
    <ConversationNotificationsSettings
      {...getCommonProps()}
      dontNotifyForMentionsIfMuted
    />
  );
}
