// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import { boolean, select, text } from '@storybook/addon-knobs';

import type { PropsType } from './CallManager';
import { CallManager } from './CallManager';
import {
  CallEndedReason,
  CallMode,
  CallState,
  CallViewMode,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling';
import type { ConversationTypeType } from '../state/ducks/conversations';
import type { AvatarColorType } from '../types/Colors';
import { AvatarColors } from '../types/Colors';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { fakeGetGroupCallVideoFrameSource } from '../test-both/helpers/fakeGetGroupCallVideoFrameSource';
import { setupI18n } from '../util/setupI18n';
import type { SafetyNumberProps } from './SafetyNumberChangeDialog';
import enMessages from '../../_locales/en/messages.json';
import { ThemeType } from '../types/Util';

const i18n = setupI18n('en', enMessages);

const getConversation = () =>
  getDefaultConversation({
    id: '3051234567',
    avatarPath: undefined,
    color: select(
      'Callee color',
      AvatarColors,
      'ultramarine' as AvatarColorType
    ),
    title: text('Callee Title', 'Rick Sanchez'),
    name: text('Callee Name', 'Rick Sanchez'),
    phoneNumber: '3051234567',
    profileName: 'Rick Sanchez',
    markedUnread: false,
    type: 'direct' as ConversationTypeType,
    lastUpdated: Date.now(),
  });

const getCommonActiveCallData = () => ({
  conversation: getConversation(),
  joinedAt: Date.now(),
  hasLocalAudio: boolean('hasLocalAudio', true),
  hasLocalVideo: boolean('hasLocalVideo', false),
  localAudioLevel: select('localAudioLevel', [0, 0.5, 1], 0),
  viewMode: select(
    'viewMode',
    [CallViewMode.Grid, CallViewMode.Presentation, CallViewMode.Speaker],
    CallViewMode.Grid
  ),
  outgoingRing: boolean('outgoingRing', true),
  pip: boolean('pip', false),
  settingsDialogOpen: boolean('settingsDialogOpen', false),
  showParticipantsList: boolean('showParticipantsList', false),
});

const createProps = (storyProps: Partial<PropsType> = {}): PropsType => ({
  ...storyProps,
  availableCameras: [],
  acceptCall: action('accept-call'),
  bounceAppIconStart: action('bounce-app-icon-start'),
  bounceAppIconStop: action('bounce-app-icon-stop'),
  cancelCall: action('cancel-call'),
  closeNeedPermissionScreen: action('close-need-permission-screen'),
  declineCall: action('decline-call'),
  getGroupCallVideoFrameSource: (_: string, demuxId: number) =>
    fakeGetGroupCallVideoFrameSource(demuxId),
  getPreferredBadge: () => undefined,
  getPresentingSources: action('get-presenting-sources'),
  hangUpActiveCall: action('hang-up-active-call'),
  i18n,
  isGroupCallOutboundRingEnabled: true,
  keyChangeOk: action('key-change-ok'),
  me: {
    ...getDefaultConversation({
      color: select(
        'Caller color',
        AvatarColors,
        'ultramarine' as AvatarColorType
      ),
      title: text('Caller Title', 'Morty Smith'),
    }),
    uuid: 'cb0dd0c8-7393-41e9-a0aa-d631c4109541',
  },
  notifyForCall: action('notify-for-call'),
  openSystemPreferencesAction: action('open-system-preferences-action'),
  playRingtone: action('play-ringtone'),
  renderDeviceSelection: () => <div />,
  renderSafetyNumberViewer: (_: SafetyNumberProps) => <div />,
  setGroupCallVideoRequest: action('set-group-call-video-request'),
  setIsCallActive: action('set-is-call-active'),
  setLocalAudio: action('set-local-audio'),
  setLocalPreview: action('set-local-preview'),
  setLocalVideo: action('set-local-video'),
  setPresenting: action('toggle-presenting'),
  setRendererCanvas: action('set-renderer-canvas'),
  setOutgoingRing: action('set-outgoing-ring'),
  startCall: action('start-call'),
  stopRingtone: action('stop-ringtone'),
  switchToPresentationView: action('switch-to-presentation-view'),
  switchFromPresentationView: action('switch-from-presentation-view'),
  theme: ThemeType.light,
  toggleParticipants: action('toggle-participants'),
  togglePip: action('toggle-pip'),
  toggleScreenRecordingPermissionsDialog: action(
    'toggle-screen-recording-permissions-dialog'
  ),
  toggleSettings: action('toggle-settings'),
  toggleSpeakerView: action('toggle-speaker-view'),
});

export default {
  title: 'Components/CallManager',
};

export const NoCall = (): JSX.Element => <CallManager {...createProps()} />;

export const OngoingDirectCall = (): JSX.Element => (
  <CallManager
    {...createProps({
      activeCall: {
        ...getCommonActiveCallData(),
        callMode: CallMode.Direct,
        callState: CallState.Accepted,
        peekedParticipants: [],
        remoteParticipants: [
          { hasRemoteVideo: true, presenting: false, title: 'Remy' },
        ],
      },
    })}
  />
);

export const OngoingGroupCall = (): JSX.Element => (
  <CallManager
    {...createProps({
      activeCall: {
        ...getCommonActiveCallData(),
        callMode: CallMode.Group,
        connectionState: GroupCallConnectionState.Connected,
        conversationsWithSafetyNumberChanges: [],
        deviceCount: 0,
        joinState: GroupCallJoinState.Joined,
        maxDevices: 5,
        groupMembers: [],
        peekedParticipants: [],
        remoteParticipants: [],
        remoteAudioLevels: new Map<number, number>(),
      },
    })}
  />
);

export const RingingDirectCall = (): JSX.Element => (
  <CallManager
    {...createProps({
      incomingCall: {
        callMode: CallMode.Direct as const,
        conversation: getConversation(),
        isVideoCall: true,
      },
    })}
  />
);

RingingDirectCall.story = {
  name: 'Ringing (direct call)',
};

export const RingingGroupCall = (): JSX.Element => (
  <CallManager
    {...createProps({
      incomingCall: {
        callMode: CallMode.Group as const,
        conversation: {
          ...getConversation(),
          type: 'group',
          title: 'Tahoe Trip',
        },
        otherMembersRung: [
          { firstName: 'Morty', title: 'Morty Smith' },
          { firstName: 'Summer', title: 'Summer Smith' },
        ],
        ringer: { firstName: 'Rick', title: 'Rick Sanchez' },
      },
    })}
  />
);

RingingGroupCall.story = {
  name: 'Ringing (group call)',
};

export const CallRequestNeeded = (): JSX.Element => (
  <CallManager
    {...createProps({
      activeCall: {
        ...getCommonActiveCallData(),
        callEndedReason: CallEndedReason.RemoteHangupNeedPermission,
        callMode: CallMode.Direct,
        callState: CallState.Accepted,
        peekedParticipants: [],
        remoteParticipants: [
          { hasRemoteVideo: true, presenting: false, title: 'Mike' },
        ],
      },
    })}
  />
);

export const GroupCallSafetyNumberChanged = (): JSX.Element => (
  <CallManager
    {...createProps({
      activeCall: {
        ...getCommonActiveCallData(),
        callMode: CallMode.Group,
        connectionState: GroupCallConnectionState.Connected,
        conversationsWithSafetyNumberChanges: [
          {
            ...getDefaultConversation({
              title: 'Aaron',
            }),
          },
        ],
        deviceCount: 0,
        joinState: GroupCallJoinState.Joined,
        maxDevices: 5,
        groupMembers: [],
        peekedParticipants: [],
        remoteParticipants: [],
        remoteAudioLevels: new Map<number, number>(),
      },
    })}
  />
);

GroupCallSafetyNumberChanged.story = {
  name: 'Group call - Safety Number Changed',
};
