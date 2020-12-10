// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { noop } from 'lodash';
import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import {
  CallMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
  GroupCallRemoteParticipantType,
} from '../types/Calling';
import { ConversationType } from '../state/ducks/conversations';
import { Colors } from '../types/Colors';
import { CallScreen, PropsType } from './CallScreen';
import { setup as setupI18n } from '../../js/modules/i18n';
import { missingCaseError } from '../util/missingCaseError';
import { getDefaultConversation } from '../util/getDefaultConversation';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const conversation = {
  id: '3051234567',
  avatarPath: undefined,
  color: Colors[0],
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
  profileName: 'Rick Sanchez',
  markedUnread: false,
  type: 'direct' as const,
  lastUpdated: Date.now(),
};

interface OverridePropsBase {
  hasLocalAudio?: boolean;
  hasLocalVideo?: boolean;
}

interface DirectCallOverrideProps extends OverridePropsBase {
  callMode: CallMode.Direct;
  callState?: CallState;
  hasRemoteVideo?: boolean;
}

interface GroupCallOverrideProps extends OverridePropsBase {
  callMode: CallMode.Group;
  connectionState?: GroupCallConnectionState;
  peekedParticipants?: Array<ConversationType>;
  remoteParticipants?: Array<GroupCallRemoteParticipantType>;
}

const createActiveDirectCallProp = (
  overrideProps: DirectCallOverrideProps
) => ({
  callMode: CallMode.Direct as CallMode.Direct,
  conversation,
  callState: select(
    'callState',
    CallState,
    overrideProps.callState || CallState.Accepted
  ),
  peekedParticipants: [] as [],
  remoteParticipants: [
    {
      hasRemoteVideo: boolean(
        'hasRemoteVideo',
        Boolean(overrideProps.hasRemoteVideo)
      ),
    },
  ] as [
    {
      hasRemoteVideo: boolean;
    }
  ],
});

const createActiveGroupCallProp = (overrideProps: GroupCallOverrideProps) => ({
  callMode: CallMode.Group as CallMode.Group,
  connectionState:
    overrideProps.connectionState || GroupCallConnectionState.Connected,
  conversationsWithSafetyNumberChanges: [],
  joinState: GroupCallJoinState.Joined,
  maxDevices: 5,
  deviceCount: (overrideProps.remoteParticipants || []).length,
  // Because remote participants are a superset, we can use them in place of peeked
  //   participants.
  peekedParticipants:
    overrideProps.peekedParticipants || overrideProps.remoteParticipants || [],
  remoteParticipants: overrideProps.remoteParticipants || [],
});

const createActiveCallProp = (
  overrideProps: DirectCallOverrideProps | GroupCallOverrideProps
) => {
  const baseResult = {
    joinedAt: Date.now(),
    conversation,
    hasLocalAudio: boolean(
      'hasLocalAudio',
      overrideProps.hasLocalAudio || false
    ),
    hasLocalVideo: boolean(
      'hasLocalVideo',
      overrideProps.hasLocalVideo || false
    ),
    pip: false,
    settingsDialogOpen: false,
    showParticipantsList: false,
  };

  switch (overrideProps.callMode) {
    case CallMode.Direct:
      return { ...baseResult, ...createActiveDirectCallProp(overrideProps) };
    case CallMode.Group:
      return { ...baseResult, ...createActiveGroupCallProp(overrideProps) };
    default:
      throw missingCaseError(overrideProps);
  }
};

const createProps = (
  overrideProps: DirectCallOverrideProps | GroupCallOverrideProps = {
    callMode: CallMode.Direct as CallMode.Direct,
  }
): PropsType => ({
  activeCall: createActiveCallProp(overrideProps),
  // We allow `any` here because this is fake and actually comes from RingRTC, which we
  //   can't import.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getGroupCallVideoFrameSource: noop as any,
  hangUp: action('hang-up'),
  i18n,
  me: {
    color: Colors[1],
    name: 'Morty Smith',
    profileName: 'Morty Smith',
    title: 'Morty Smith',
  },
  setGroupCallVideoRequest: action('set-group-call-video-request'),
  setLocalAudio: action('set-local-audio'),
  setLocalPreview: action('set-local-preview'),
  setLocalVideo: action('set-local-video'),
  setRendererCanvas: action('set-renderer-canvas'),
  stickyControls: boolean('stickyControls', false),
  toggleParticipants: action('toggle-participants'),
  togglePip: action('toggle-pip'),
  toggleSettings: action('toggle-settings'),
});

const story = storiesOf('Components/CallScreen', module);

story.add('Default', () => {
  return <CallScreen {...createProps()} />;
});

story.add('Pre-Ring', () => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        callState: CallState.Prering,
      })}
    />
  );
});

story.add('Ringing', () => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        callState: CallState.Ringing,
      })}
    />
  );
});

story.add('Reconnecting', () => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        callState: CallState.Reconnecting,
      })}
    />
  );
});

story.add('Ended', () => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        callState: CallState.Ended,
      })}
    />
  );
});

story.add('hasLocalAudio', () => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        hasLocalAudio: true,
      })}
    />
  );
});

story.add('hasLocalVideo', () => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        hasLocalVideo: true,
      })}
    />
  );
});

story.add('hasRemoteVideo', () => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        hasRemoteVideo: true,
      })}
    />
  );
});

story.add('Group call - 1', () => (
  <CallScreen
    {...createProps({
      callMode: CallMode.Group,
      remoteParticipants: [
        {
          demuxId: 0,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          videoAspectRatio: 1.3,
          ...getDefaultConversation({
            isBlocked: false,
            uuid: '72fa60e5-25fb-472d-8a56-e56867c57dda',
            title: 'Tyler',
          }),
        },
      ],
    })}
  />
));

story.add('Group call - Many', () => (
  <CallScreen
    {...createProps({
      callMode: CallMode.Group,
      remoteParticipants: [
        {
          demuxId: 0,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          videoAspectRatio: 1.3,
          ...getDefaultConversation({
            isBlocked: false,
            title: 'Amy',
            uuid: '094586f5-8fc2-4ce2-a152-2dfcc99f4630',
          }),
        },
        {
          demuxId: 1,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          videoAspectRatio: 1.3,
          ...getDefaultConversation({
            isBlocked: false,
            title: 'Bob',
            uuid: 'cb5bdb24-4cbb-4650-8a7a-1a2807051e74',
          }),
        },
        {
          demuxId: 2,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          videoAspectRatio: 1.3,
          ...getDefaultConversation({
            isBlocked: true,
            title: 'Alice',
            uuid: '2d7d13ae-53dc-4a51-8dc7-976cd85e0b57',
          }),
        },
      ],
    })}
  />
));

story.add('Group call - reconnecting', () => (
  <CallScreen
    {...createProps({
      callMode: CallMode.Group,
      connectionState: GroupCallConnectionState.Reconnecting,
      remoteParticipants: [
        {
          demuxId: 0,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          videoAspectRatio: 1.3,
          ...getDefaultConversation({
            isBlocked: false,
            title: 'Tyler',
            uuid: '33871c64-0c22-45ce-8aa4-0ec237ac4a31',
          }),
        },
      ],
    })}
  />
));

story.add('Group call - 0', () => (
  <CallScreen
    {...createProps({
      callMode: CallMode.Group,
      remoteParticipants: [],
    })}
  />
));
