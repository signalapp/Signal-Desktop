// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './WhileMutedSettings.dom.tsx';
import { WhileMutedSettings } from './WhileMutedSettings.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ConversationDetails/WhileMutedSettings',
} satisfies Meta<PropsType>;

const getCommonProps = () => ({
  i18n,
  isGroup: true,
  notifyWhileMuted: { calls: false, mentions: true, replies: true },
  setNotifyWhileMuted: action('setNotifyWhileMuted'),
});

export function Defaults(): JSX.Element {
  return <WhileMutedSettings {...getCommonProps()} />;
}

export function DirectConversation(): JSX.Element {
  return <WhileMutedSettings {...getCommonProps()} isGroup={false} />;
}

export function AllOn(): JSX.Element {
  return (
    <WhileMutedSettings
      {...getCommonProps()}
      notifyWhileMuted={{ calls: true, mentions: true, replies: true }}
    />
  );
}

export function AllOff(): JSX.Element {
  return (
    <WhileMutedSettings
      {...getCommonProps()}
      notifyWhileMuted={{ calls: false, mentions: false, replies: false }}
    />
  );
}
