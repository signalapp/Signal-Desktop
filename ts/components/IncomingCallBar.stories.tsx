// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { IncomingCallBar } from './IncomingCallBar';
import { CallMode } from '../types/Calling';
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
    avatarPath: undefined,
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
  avatarPath: undefined,
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
  profileName: 'Rick Sanchez',
  title: 'Rick Sanchez',
});

const groupConversation = getDefaultConversation({
  avatarPath: undefined,
  name: 'Tahoe Trip',
  title: 'Tahoe Trip',
  type: 'group',
});

storiesOf('Components/IncomingCallBar', module)
  .add('Incoming direct call (video)', () => (
    <IncomingCallBar
      {...commonProps}
      conversation={directConversation}
      callMode={CallMode.Direct}
      isVideoCall
    />
  ))
  .add('Incoming direct call (audio)', () => (
    <IncomingCallBar
      {...commonProps}
      conversation={directConversation}
      callMode={CallMode.Direct}
      isVideoCall={false}
    />
  ))
  .add('Incoming group call (only calling you)', () => (
    <IncomingCallBar
      {...commonProps}
      conversation={groupConversation}
      callMode={CallMode.Group}
      otherMembersRung={[]}
      ringer={{ firstName: 'Rick', title: 'Rick Sanchez' }}
    />
  ))
  .add('Incoming group call (calling you and 1 other)', () => (
    <IncomingCallBar
      {...commonProps}
      conversation={groupConversation}
      callMode={CallMode.Group}
      otherMembersRung={[{ firstName: 'Morty', title: 'Morty Smith' }]}
      ringer={{ firstName: 'Rick', title: 'Rick Sanchez' }}
    />
  ))
  .add('Incoming group call (calling you and 2 others)', () => (
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
  ))
  .add('Incoming group call (calling you and 3 others)', () => (
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
  ))
  .add('Incoming group call (calling you and 4 others)', () => (
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
  ));
