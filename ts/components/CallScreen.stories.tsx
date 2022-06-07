// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { times } from 'lodash';
import { boolean, select, number } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { GroupCallRemoteParticipantType } from '../types/Calling';
import {
  CallMode,
  CallViewMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling';
import type { ConversationType } from '../state/ducks/conversations';
import { AvatarColors } from '../types/Colors';
import type { PropsType } from './CallScreen';
import { CallScreen } from './CallScreen';
import { setupI18n } from '../util/setupI18n';
import { missingCaseError } from '../util/missingCaseError';
import {
  getDefaultConversation,
  getDefaultConversationWithUuid,
} from '../test-both/helpers/getDefaultConversation';
import { fakeGetGroupCallVideoFrameSource } from '../test-both/helpers/fakeGetGroupCallVideoFrameSource';
import enMessages from '../../_locales/en/messages.json';

const MAX_PARTICIPANTS = 64;

const i18n = setupI18n('en', enMessages);

const conversation = getDefaultConversation({
  id: '3051234567',
  avatarPath: undefined,
  color: AvatarColors[0],
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
  profileName: 'Rick Sanchez',
});

type OverridePropsBase = {
  hasLocalAudio?: boolean;
  hasLocalVideo?: boolean;
  localAudioLevel?: number;
  viewMode?: CallViewMode;
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
      presenting: false,
      title: 'test',
    },
  ] as [
    {
      hasRemoteVideo: boolean;
      presenting: boolean;
      title: string;
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
  groupMembers: overrideProps.remoteParticipants || [],
  // Because remote participants are a superset, we can use them in place of peeked
  //   participants.
  peekedParticipants:
    overrideProps.peekedParticipants || overrideProps.remoteParticipants || [],
  remoteParticipants: overrideProps.remoteParticipants || [],
  remoteAudioLevels: new Map<number, number>(),
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
    localAudioLevel: select(
      'localAudioLevel',
      [0, 0.5, 1],
      overrideProps.localAudioLevel || 0
    ),
    viewMode: select(
      'viewMode',
      [CallViewMode.Grid, CallViewMode.Speaker, CallViewMode.Presentation],
      overrideProps.viewMode || CallViewMode.Grid
    ),
    outgoingRing: true,
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
  getPresentingSources: action('get-presenting-sources'),
  hangUpActiveCall: action('hang-up'),
  i18n,
  me: getDefaultConversation({
    color: AvatarColors[1],
    id: '6146087e-f7ef-457e-9a8d-47df1fdd6b25',
    name: 'Morty Smith',
    profileName: 'Morty Smith',
    title: 'Morty Smith',
    uuid: '3c134598-eecb-42ab-9ad3-2b0873f771b2',
  }),
  openSystemPreferencesAction: action('open-system-preferences-action'),
  setGroupCallVideoRequest: action('set-group-call-video-request'),
  setLocalAudio: action('set-local-audio'),
  setLocalPreview: action('set-local-preview'),
  setLocalVideo: action('set-local-video'),
  setPresenting: action('toggle-presenting'),
  setRendererCanvas: action('set-renderer-canvas'),
  stickyControls: boolean('stickyControls', false),
  switchToPresentationView: action('switch-to-presentation-view'),
  switchFromPresentationView: action('switch-from-presentation-view'),
  toggleParticipants: action('toggle-participants'),
  togglePip: action('toggle-pip'),
  toggleScreenRecordingPermissionsDialog: action(
    'toggle-screen-recording-permissions-dialog'
  ),
  toggleSettings: action('toggle-settings'),
  toggleSpeakerView: action('toggle-speaker-view'),
});

export default {
  title: 'Components/CallScreen',
};

export const Default = (): JSX.Element => {
  return <CallScreen {...createProps()} />;
};

export const PreRing = (): JSX.Element => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        callState: CallState.Prering,
      })}
    />
  );
};

PreRing.story = {
  name: 'Pre-Ring',
};

export const _Ringing = (): JSX.Element => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        callState: CallState.Ringing,
      })}
    />
  );
};

export const _Reconnecting = (): JSX.Element => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        callState: CallState.Reconnecting,
      })}
    />
  );
};

export const _Ended = (): JSX.Element => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        callState: CallState.Ended,
      })}
    />
  );
};

export const HasLocalAudio = (): JSX.Element => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        hasLocalAudio: true,
      })}
    />
  );
};

HasLocalAudio.story = {
  name: 'hasLocalAudio',
};

export const HasLocalVideo = (): JSX.Element => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        hasLocalVideo: true,
      })}
    />
  );
};

HasLocalVideo.story = {
  name: 'hasLocalVideo',
};

export const HasRemoteVideo = (): JSX.Element => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        hasRemoteVideo: true,
      })}
    />
  );
};

HasRemoteVideo.story = {
  name: 'hasRemoteVideo',
};

export const GroupCall1 = (): JSX.Element => (
  <CallScreen
    {...createProps({
      callMode: CallMode.Group,
      remoteParticipants: [
        {
          demuxId: 0,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          presenting: false,
          sharingScreen: false,
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
);

GroupCall1.story = {
  name: 'Group call - 1',
};

// We generate these upfront so that the list is stable when you move the slider.
const allRemoteParticipants = times(MAX_PARTICIPANTS).map(index => ({
  demuxId: index,
  hasRemoteAudio: index % 3 !== 0,
  hasRemoteVideo: index % 4 !== 0,
  presenting: false,
  sharingScreen: false,
  videoAspectRatio: 1.3,
  ...getDefaultConversationWithUuid({
    isBlocked: index === 10 || index === MAX_PARTICIPANTS - 1,
    title: `Participant ${index + 1}`,
  }),
}));

export const GroupCallMany = (): JSX.Element => {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Group,
        remoteParticipants: allRemoteParticipants.slice(
          0,
          number('Participant count', 40, {
            range: true,
            min: 0,
            max: MAX_PARTICIPANTS,
            step: 1,
          })
        ),
      })}
    />
  );
};

GroupCallMany.story = {
  name: 'Group call - Many',
};

export const GroupCallReconnecting = (): JSX.Element => (
  <CallScreen
    {...createProps({
      callMode: CallMode.Group,
      connectionState: GroupCallConnectionState.Reconnecting,
      remoteParticipants: [
        {
          demuxId: 0,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          presenting: false,
          sharingScreen: false,
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
);

GroupCallReconnecting.story = {
  name: 'Group call - reconnecting',
};

export const GroupCall0 = (): JSX.Element => (
  <CallScreen
    {...createProps({
      callMode: CallMode.Group,
      remoteParticipants: [],
    })}
  />
);

GroupCall0.story = {
  name: 'Group call - 0',
};

export const GroupCallSomeoneIsSharingScreen = (): JSX.Element => (
  <CallScreen
    {...createProps({
      callMode: CallMode.Group,
      remoteParticipants: allRemoteParticipants
        .slice(0, 5)
        .map((participant, index) => ({
          ...participant,
          presenting: index === 1,
          sharingScreen: index === 1,
        })),
    })}
  />
);

GroupCallSomeoneIsSharingScreen.story = {
  name: 'Group call - someone is sharing screen',
};

export const GroupCallSomeoneIsSharingScreenAndYoureReconnecting =
  (): JSX.Element => (
    <CallScreen
      {...createProps({
        callMode: CallMode.Group,
        connectionState: GroupCallConnectionState.Reconnecting,
        remoteParticipants: allRemoteParticipants
          .slice(0, 5)
          .map((participant, index) => ({
            ...participant,
            presenting: index === 1,
            sharingScreen: index === 1,
          })),
      })}
    />
  );

GroupCallSomeoneIsSharingScreenAndYoureReconnecting.story = {
  name: "Group call - someone is sharing screen and you're reconnecting",
};
