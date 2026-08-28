// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './ConversationNotificationsSettings.dom.tsx';
import { ConversationNotificationsSettings } from './ConversationNotificationsSettings.dom.tsx';
import { MuteExpiration } from '@signalapp/types';

const { i18n } = window.SignalContext;

export default {
  title:
    'Components/Conversation/ConversationDetails/ConversationNotificationsSettings',
} satisfies Meta<PropsType>;

const getCommonProps = () => ({
  id: 'conversation-id',
  isGroup: true,
  muteExpiresAt: undefined,
  notifyWhileMuted: { calls: false, mentions: true, replies: true },
  i18n,
  onOpenWhileMutedSettings: action('onOpenWhileMutedSettings'),
  setMuteExpiration: action('setMuteExpiration'),
});

export function NotMuted(): JSX.Element {
  return <ConversationNotificationsSettings {...getCommonProps()} />;
}

export function Muted(): JSX.Element {
  return (
    <ConversationNotificationsSettings
      {...getCommonProps()}
      muteExpiresAt={MuteExpiration.fromNumber(Date.UTC(2099, 5, 9))}
    />
  );
}

export function MutedAlways(): JSX.Element {
  return (
    <ConversationNotificationsSettings
      {...getCommonProps()}
      muteExpiresAt={MuteExpiration.ALWAYS}
    />
  );
}

export function NothingWhileMuted(): JSX.Element {
  return (
    <ConversationNotificationsSettings
      {...getCommonProps()}
      notifyWhileMuted={{ calls: false, mentions: false, replies: false }}
    />
  );
}

export function EverythingWhileMuted(): JSX.Element {
  return (
    <ConversationNotificationsSettings
      {...getCommonProps()}
      notifyWhileMuted={{ calls: true, mentions: true, replies: true }}
    />
  );
}

export function DirectConversation(): JSX.Element {
  return (
    <ConversationNotificationsSettings
      {...getCommonProps()}
      isGroup={false}
      notifyWhileMuted={{ calls: true, mentions: true, replies: true }}
    />
  );
}
