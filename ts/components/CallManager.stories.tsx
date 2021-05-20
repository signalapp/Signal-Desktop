// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean, select, text } from '@storybook/addon-knobs';

import { CallManager, PropsType } from './CallManager';
import {
  CallEndedReason,
  CallMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling';
import { ConversationTypeType } from '../state/ducks/conversations';
import { Colors, ColorType } from '../types/Colors';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { fakeGetGroupCallVideoFrameSource } from '../test-both/helpers/fakeGetGroupCallVideoFrameSource';
import { setup as setupI18n } from '../../js/modules/i18n';
import { Props as SafetyNumberViewerProps } from '../state/smart/SafetyNumberViewer';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const getConversation = () =>
  getDefaultConversation({
    id: '3051234567',
    avatarPath: undefined,
    color: select('Callee color', Colors, 'ultramarine' as ColorType),
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
  pip: boolean('pip', false),
  settingsDialogOpen: boolean('settingsDialogOpen', false),
  showParticipantsList: boolean('showParticipantsList', false),
});

const getIncomingCallState = (extraProps = {}) => ({
  ...extraProps,
  callMode: CallMode.Direct as CallMode.Direct,
  conversationId: '3051234567',
  callState: CallState.Ringing,
  isIncoming: true,
  isVideoCall: boolean('isVideoCall', true),
  hasRemoteVideo: true,
});

const createProps = (storyProps: Partial<PropsType> = {}): PropsType => ({
  ...storyProps,
  availableCameras: [],
  acceptCall: action('accept-call'),
  cancelCall: action('cancel-call'),
  closeNeedPermissionScreen: action('close-need-permission-screen'),
  declineCall: action('decline-call'),
  getGroupCallVideoFrameSource: (_: string, demuxId: number) =>
    fakeGetGroupCallVideoFrameSource(demuxId),
  getPresentingSources: action('get-presenting-sources'),
  hangUp: action('hang-up'),
  i18n,
  keyChangeOk: action('key-change-ok'),
  me: {
    ...getDefaultConversation({
      color: select('Caller color', Colors, 'ultramarine' as ColorType),
      title: text('Caller Title', 'Morty Smith'),
    }),
    uuid: 'cb0dd0c8-7393-41e9-a0aa-d631c4109541',
  },
  openSystemPreferencesAction: action('open-system-preferences-action'),
  renderDeviceSelection: () => <div />,
  renderSafetyNumberViewer: (_: SafetyNumberViewerProps) => <div />,
  setGroupCallVideoRequest: action('set-group-call-video-request'),
  setLocalAudio: action('set-local-audio'),
  setLocalPreview: action('set-local-preview'),
  setLocalVideo: action('set-local-video'),
  setPresenting: action('toggle-presenting'),
  setRendererCanvas: action('set-renderer-canvas'),
  startCall: action('start-call'),
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
        peekedParticipants: [],
        remoteParticipants: [],
      },
    })}
  />
));

story.add('Ringing', () => (
  <CallManager
    {...createProps({
      incomingCall: {
        call: getIncomingCallState(),
        conversation: getConversation(),
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
        peekedParticipants: [],
        remoteParticipants: [],
      },
    })}
  />
));
