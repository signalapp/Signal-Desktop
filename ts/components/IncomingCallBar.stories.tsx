// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './IncomingCallBar';
import { IncomingCallBar } from './IncomingCallBar';
import { CallMode } from '../types/CallDisposition';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

const commonProps = {
  acceptCall: action('accept-call'),
  bounceAppIconStart: action('bounceAppIconStart'),
  bounceAppIconStop: action('bounceAppIconStop'),
  call: {
    conversationId: 'fake-conversation-id',
    callId: 0,
    isIncoming: true,
    isVideoCall: true,
  },
  conversation: getDefaultConversation({
    id: '3051234567',
    avatarUrl: undefined,
    name: 'Rick Sanchez',
    phoneNumber: '3051234567',
    profileName: 'Rick Sanchez',
    title: 'Rick Sanchez',
  }),
  declineCall: action('decline-call'),
  i18n,
  notifyForCall: action('notify-for-call'),
};

const directConversation = getDefaultConversation({
  id: '3051234567',
  avatarUrl: undefined,
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
  profileName: 'Rick Sanchez',
  title: 'Rick Sanchez',
});

const groupConversation = getDefaultConversation({
  avatarUrl: undefined,
  name: 'Tahoe Trip',
  title: 'Tahoe Trip',
  type: 'group',
});

export default {
  title: 'Components/IncomingCallBar',
} satisfies Meta<PropsType>;

export function IncomingDirectCallVideo(): JSX.Element {
  return (
    <IncomingCallBar
      {...commonProps}
      conversation={directConversation}
      callMode={CallMode.Direct}
      isVideoCall
    />
  );
}

export function IncomingDirectCallAudio(): JSX.Element {
  return (
    <IncomingCallBar
      {...commonProps}
      conversation={directConversation}
      callMode={CallMode.Direct}
      isVideoCall={false}
    />
  );
}

export function IncomingGroupCallOnlyCallingYou(): JSX.Element {
  return (
    <IncomingCallBar
      {...commonProps}
      conversation={groupConversation}
      callMode={CallMode.Group}
      otherMembersRung={[]}
      ringer={{ firstName: 'Rick', title: 'Rick Sanchez' }}
    />
  );
}

export function IncomingGroupCallCallingYouAnd1Other(): JSX.Element {
  return (
    <IncomingCallBar
      {...commonProps}
      conversation={groupConversation}
      callMode={CallMode.Group}
      otherMembersRung={[{ firstName: 'Morty', title: 'Morty Smith' }]}
      ringer={{ firstName: 'Rick', title: 'Rick Sanchez' }}
    />
  );
}

export function IncomingGroupCallCallingYouAnd2Others(): JSX.Element {
  return (
    <IncomingCallBar
      {...commonProps}
      conversation={groupConversation}
      callMode={CallMode.Group}
      otherMembersRung={[
        { firstName: 'Morty', title: 'Morty Smith' },
        { firstName: 'Summer', title: 'Summer Smith' },
      ]}
      ringer={{ firstName: 'Rick', title: 'Rick Sanchez' }}
    />
  );
}

export function IncomingGroupCallCallingYouAnd3Others(): JSX.Element {
  return (
    <IncomingCallBar
      {...commonProps}
      conversation={groupConversation}
      callMode={CallMode.Group}
      otherMembersRung={[
        { firstName: 'Morty', title: 'Morty Smith' },
        { firstName: 'Summer', title: 'Summer Smith' },
        { firstName: 'Beth', title: 'Beth Smith' },
      ]}
      ringer={{ firstName: 'Rick', title: 'Rick Sanchez' }}
    />
  );
}

export function IncomingGroupCallCallingYouAnd4Others(): JSX.Element {
  return (
    <IncomingCallBar
      {...commonProps}
      conversation={groupConversation}
      callMode={CallMode.Group}
      otherMembersRung={[
        { firstName: 'Morty', title: 'Morty Smith' },
        { firstName: 'Summer', title: 'Summer Smith' },
        { firstName: 'Beth', title: 'Beth Sanchez' },
        { firstName: 'Jerry', title: 'Beth Smith' },
      ]}
      ringer={{ firstName: 'Rick', title: 'Rick Sanchez' }}
    />
  );
}
