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
  GroupCallRemoteParticipantType,
} from '../types/Calling';
import { Colors } from '../types/Colors';
import {
  DirectCallStateType,
  GroupCallStateType,
} from '../state/ducks/calling';
import { CallScreen, PropsType } from './CallScreen';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

function getGroupCallState(): GroupCallStateType {
  return {
    callMode: CallMode.Group,
    conversationId: '3051234567',
    connectionState: 2,
    joinState: 2,
    peekInfo: {
      conversationIds: [],
      maxDevices: 16,
      deviceCount: 0,
    },
    remoteParticipants: [],
  };
}

function getDirectCallState(
  overrideProps: {
    callState?: CallState;
    hasRemoteVideo?: boolean;
  } = {}
): DirectCallStateType {
  return {
    callMode: CallMode.Direct,
    conversationId: '3051234567',
    callState: select(
      'callState',
      CallState,
      overrideProps.callState || CallState.Accepted
    ),
    hasRemoteVideo: boolean(
      'hasRemoteVideo',
      Boolean(overrideProps.hasRemoteVideo)
    ),
    isIncoming: false,
    isVideoCall: true,
  };
}

const createProps = (
  overrideProps: {
    callState?: CallState;
    callTypeState?: DirectCallStateType | GroupCallStateType;
    groupCallParticipants?: Array<GroupCallRemoteParticipantType>;
    hasLocalAudio?: boolean;
    hasLocalVideo?: boolean;
    hasRemoteVideo?: boolean;
  } = {}
): PropsType => ({
  activeCall: {
    activeCallState: {
      conversationId: '123',
      hasLocalAudio: true,
      hasLocalVideo: true,
      pip: false,
      settingsDialogOpen: false,
      showParticipantsList: true,
    },
    call: overrideProps.callTypeState || getDirectCallState(overrideProps),
    conversation: {
      id: '3051234567',
      avatarPath: undefined,
      color: Colors[0],
      title: 'Rick Sanchez',
      name: 'Rick Sanchez',
      phoneNumber: '3051234567',
      profileName: 'Rick Sanchez',
      markedUnread: false,
      type: 'direct',
      lastUpdated: Date.now(),
    },
    isCallFull: false,
    groupCallPeekedParticipants: [],
    groupCallParticipants: overrideProps.groupCallParticipants || [],
  },
  // We allow `any` here because this is fake and actually comes from RingRTC, which we
  //   can't import.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getGroupCallVideoFrameSource: noop as any,
  hangUp: action('hang-up'),
  hasLocalAudio: boolean('hasLocalAudio', overrideProps.hasLocalAudio || false),
  hasLocalVideo: boolean('hasLocalVideo', overrideProps.hasLocalVideo || false),
  i18n,
  joinedAt: Date.now(),
  me: {
    color: Colors[1],
    name: 'Morty Smith',
    profileName: 'Morty Smith',
    title: 'Morty Smith',
  },
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
        callState: CallState.Prering,
      })}
    />
  );
});

story.add('Ringing', () => {
  return (
    <CallScreen
      {...createProps({
        callState: CallState.Ringing,
      })}
    />
  );
});

story.add('Reconnecting', () => {
  return (
    <CallScreen
      {...createProps({
        callState: CallState.Reconnecting,
      })}
    />
  );
});

story.add('Ended', () => {
  return (
    <CallScreen
      {...createProps({
        callState: CallState.Ended,
      })}
    />
  );
});

story.add('hasLocalAudio', () => {
  return <CallScreen {...createProps({ hasLocalAudio: true })} />;
});

story.add('hasLocalVideo', () => {
  return <CallScreen {...createProps({ hasLocalVideo: true })} />;
});

story.add('hasRemoteVideo', () => {
  return <CallScreen {...createProps({ hasRemoteVideo: true })} />;
});

story.add('Group call - 1', () => (
  <CallScreen
    {...createProps({
      callTypeState: getGroupCallState(),
      groupCallParticipants: [
        {
          demuxId: 0,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          isSelf: false,
          title: 'Tyler',
          videoAspectRatio: 1.3,
        },
      ],
    })}
  />
));

story.add('Group call - Many', () => (
  <CallScreen
    {...createProps({
      callTypeState: getGroupCallState(),
      groupCallParticipants: [
        {
          demuxId: 0,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          isSelf: false,
          title: 'Amy',
          videoAspectRatio: 1.3,
        },
        {
          demuxId: 1,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          isSelf: true,
          title: 'Bob',
          videoAspectRatio: 1.3,
        },
        {
          demuxId: 2,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          isSelf: false,
          title: 'Alice',
          videoAspectRatio: 1.3,
        },
      ],
    })}
  />
));
