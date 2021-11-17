// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean, select, text } from '@storybook/addon-knobs';

import type { PropsType } from './CallManager';
import { CallManager } from './CallManager';
import {
  CallEndedReason,
  CallMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling';
import type { ConversationTypeType } from '../state/ducks/conversations';
import type { AvatarColorType } from '../types/Colors';
import { AvatarColors } from '../types/Colors';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { fakeGetGroupCallVideoFrameSource } from '../test-both/helpers/fakeGetGroupCallVideoFrameSource';
import { setupI18n } from '../util/setupI18n';
import type { Props as SafetyNumberViewerProps } from '../state/smart/SafetyNumberViewer';
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
  isInSpeakerView: boolean('isInSpeakerView', false),
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
  hangUp: action('hang-up'),
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
  renderSafetyNumberViewer: (_: SafetyNumberViewerProps) => <div />,
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
  theme: ThemeType.light,
  toggleParticipants: action('toggle-participants'),
  togglePip: action('toggle-pip'),
  toggleScreenRecordingPermissionsDialog: action(
    'toggle-screen-recording-permissions-dialog'
  ),
  toggleSettings: action('toggle-settings'),
  toggleSpeakerView: action('toggle-speaker-view'),
});

const story = storiesOf('Components/CallManager', module);

story.add('No Call', () => <CallManager {...createProps()} />);

story.add('Ongoing Direct Call', () => (
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
));

story.add('Ongoing Group Call', () => (
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
      },
    })}
  />
));

story.add('Ringing (direct call)', () => (
  <CallManager
    {...createProps({
      incomingCall: {
        callMode: CallMode.Direct as const,
        conversation: getConversation(),
        isVideoCall: true,
      },
    })}
  />
));

story.add('Ringing (group call)', () => (
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
));

story.add('Call Request Needed', () => (
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
));

story.add('Group call - Safety Number Changed', () => (
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
      },
    })}
  />
));
