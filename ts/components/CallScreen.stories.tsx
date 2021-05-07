// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { times } from 'lodash';
import { v4 as generateUuid } from 'uuid';
import { storiesOf } from '@storybook/react';
import { boolean, select, number } from '@storybook/addon-knobs';
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
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { fakeGetGroupCallVideoFrameSource } from '../test-both/helpers/fakeGetGroupCallVideoFrameSource';
import enMessages from '../../_locales/en/messages.json';

const MAX_PARTICIPANTS = 32;

const i18n = setupI18n('en', enMessages);

const conversation = getDefaultConversation({
  id: '3051234567',
  avatarPath: undefined,
  color: Colors[0],
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
  profileName: 'Rick Sanchez',
});

type OverridePropsBase = {
  hasLocalAudio?: boolean;
  hasLocalVideo?: boolean;
  isInSpeakerView?: boolean;
};

type DirectCallOverrideProps = OverridePropsBase & {
  callMode: CallMode.Direct;
  callState?: CallState;
  hasRemoteVideo?: boolean;
};

type GroupCallOverrideProps = OverridePropsBase & {
  callMode: CallMode.Group;
  connectionState?: GroupCallConnectionState;
  peekedParticipants?: Array<ConversationType>;
  remoteParticipants?: Array<GroupCallRemoteParticipantType>;
};

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
    isInSpeakerView: boolean(
      'isInSpeakerView',
      overrideProps.isInSpeakerView || false
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
  getGroupCallVideoFrameSource: fakeGetGroupCallVideoFrameSource,
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
  toggleSpeakerView: action('toggle-speaker-view'),
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

// We generate these upfront so that the list is stable when you move the slider.
const allRemoteParticipants = times(MAX_PARTICIPANTS).map(index => ({
  demuxId: index,
  hasRemoteAudio: index % 3 !== 0,
  hasRemoteVideo: index % 4 !== 0,
  videoAspectRatio: 1.3,
  ...getDefaultConversation({
    isBlocked: index === 10 || index === MAX_PARTICIPANTS - 1,
    title: `Participant ${index + 1}`,
    uuid: generateUuid(),
  }),
}));

story.add('Group call - Many', () => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Group,
        remoteParticipants: allRemoteParticipants.slice(
          0,
          number('Participant count', 3, {
            range: true,
            min: 0,
            max: MAX_PARTICIPANTS,
            step: 1,
          })
        ),
      })}
    />
  );
});

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
