// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
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

export default {
  title: 'Components/IncomingCallBar',
};

export const IncomingDirectCallVideo = (): JSX.Element => (
  <IncomingCallBar
    {...commonProps}
    conversation={directConversation}
    callMode={CallMode.Direct}
    isVideoCall
  />
);

IncomingDirectCallVideo.story = {
  name: 'Incoming direct call (video)',
};

export const IncomingDirectCallAudio = (): JSX.Element => (
  <IncomingCallBar
    {...commonProps}
    conversation={directConversation}
    callMode={CallMode.Direct}
    isVideoCall={false}
  />
);

IncomingDirectCallAudio.story = {
  name: 'Incoming direct call (audio)',
};

export const IncomingGroupCallOnlyCallingYou = (): JSX.Element => (
  <IncomingCallBar
    {...commonProps}
    conversation={groupConversation}
    callMode={CallMode.Group}
    otherMembersRung={[]}
    ringer={{ firstName: 'Rick', title: 'Rick Sanchez' }}
  />
);

IncomingGroupCallOnlyCallingYou.story = {
  name: 'Incoming group call (only calling you)',
};

export const IncomingGroupCallCallingYouAnd1Other = (): JSX.Element => (
  <IncomingCallBar
    {...commonProps}
    conversation={groupConversation}
    callMode={CallMode.Group}
    otherMembersRung={[{ firstName: 'Morty', title: 'Morty Smith' }]}
    ringer={{ firstName: 'Rick', title: 'Rick Sanchez' }}
  />
);

IncomingGroupCallCallingYouAnd1Other.story = {
  name: 'Incoming group call (calling you and 1 other)',
};

export const IncomingGroupCallCallingYouAnd2Others = (): JSX.Element => (
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

IncomingGroupCallCallingYouAnd2Others.story = {
  name: 'Incoming group call (calling you and 2 others)',
};

export const IncomingGroupCallCallingYouAnd3Others = (): JSX.Element => (
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

IncomingGroupCallCallingYouAnd3Others.story = {
  name: 'Incoming group call (calling you and 3 others)',
};

export const IncomingGroupCallCallingYouAnd4Others = (): JSX.Element => (
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

IncomingGroupCallCallingYouAnd4Others.story = {
  name: 'Incoming group call (calling you and 4 others)',
};
