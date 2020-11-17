// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { noop } from 'lodash';
import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { CallMode, CallState } from '../types/Calling';
import { Colors } from '../types/Colors';
import {
  DirectCallStateType,
  GroupCallStateType,
  GroupCallParticipantInfoType,
} from '../state/ducks/calling';
import { CallScreen, PropsType } from './CallScreen';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

function getGroupCallState(
  remoteParticipants: Array<GroupCallParticipantInfoType>
): GroupCallStateType {
  return {
    callMode: CallMode.Group,
    conversationId: '3051234567',
    connectionState: 2,
    joinState: 2,
    remoteParticipants,
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
    hasLocalAudio?: boolean;
    hasLocalVideo?: boolean;
    hasRemoteVideo?: boolean;
    remoteParticipants?: Array<GroupCallParticipantInfoType>;
  } = {}
): PropsType => ({
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
  // We allow `any` here because these are fake and actually come from RingRTC, which we
  //   can't import.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  createCanvasVideoRenderer: () =>
    ({
      setCanvas: noop,
      enable: noop,
      disable: noop,
    } as any),
  getGroupCallVideoFrameSource: noop as any,
  /* eslint-enable @typescript-eslint/no-explicit-any */
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
      callTypeState: getGroupCallState([
        {
          conversationId: '123',
          demuxId: 0,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          isSelf: false,
          videoAspectRatio: 1.3,
        },
      ]),
    })}
  />
));

story.add('Group call - Many', () => (
  <CallScreen
    {...createProps({
      callTypeState: getGroupCallState([
        {
          conversationId: '123',
          demuxId: 0,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          isSelf: false,
          videoAspectRatio: 1.3,
        },
        {
          conversationId: '456',
          demuxId: 1,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          isSelf: true,
          videoAspectRatio: 1.3,
        },
        {
          conversationId: '789',
          demuxId: 2,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          isSelf: false,
          videoAspectRatio: 1.3,
        },
      ]),
    })}
  />
));
