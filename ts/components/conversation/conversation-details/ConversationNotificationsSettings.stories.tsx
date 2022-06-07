// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import { ConversationNotificationsSettings } from './ConversationNotificationsSettings';

const i18n = setupI18n('en', enMessages);

export default {
  title:
    'Components/Conversation/ConversationDetails/ConversationNotificationsSettings',
};

const getCommonProps = () => ({
  muteExpiresAt: undefined,
  conversationType: 'group' as const,
  dontNotifyForMentionsIfMuted: false,
  i18n,
  setDontNotifyForMentionsIfMuted: action('setDontNotifyForMentionsIfMuted'),
  setMuteExpiration: action('setMuteExpiration'),
});

export const GroupConversationAllDefault = (): JSX.Element => (
  <ConversationNotificationsSettings {...getCommonProps()} />
);

GroupConversationAllDefault.story = {
  name: 'Group conversation, all default',
};

export const GroupConversationMuted = (): JSX.Element => (
  <ConversationNotificationsSettings
    {...getCommonProps()}
    muteExpiresAt={Date.UTC(2099, 5, 9)}
  />
);

GroupConversationMuted.story = {
  name: 'Group conversation, muted',
};

export const GroupConversationMentionsMuted = (): JSX.Element => (
  <ConversationNotificationsSettings
    {...getCommonProps()}
    dontNotifyForMentionsIfMuted
  />
);

GroupConversationMentionsMuted.story = {
  name: 'Group conversation, @mentions muted',
};
