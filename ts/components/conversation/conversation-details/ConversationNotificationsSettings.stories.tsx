// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import { ConversationNotificationsSettings } from './ConversationNotificationsSettings';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/ConversationNotificationsSettings',
  module
);

const getCommonProps = () => ({
  muteExpiresAt: undefined,
  conversationType: 'group' as const,
  dontNotifyForMentionsIfMuted: false,
  i18n,
  setDontNotifyForMentionsIfMuted: action('setDontNotifyForMentionsIfMuted'),
  setMuteExpiration: action('setMuteExpiration'),
});

story.add('Group conversation, all default', () => (
  <ConversationNotificationsSettings {...getCommonProps()} />
));

story.add('Group conversation, muted', () => (
  <ConversationNotificationsSettings
    {...getCommonProps()}
    muteExpiresAt={Date.UTC(2099, 5, 9)}
  />
));

story.add('Group conversation, @mentions muted', () => (
  <ConversationNotificationsSettings
    {...getCommonProps()}
    dontNotifyForMentionsIfMuted
  />
));
