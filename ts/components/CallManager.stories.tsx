// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { noop } from 'lodash';
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
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const getConversation = () => ({
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

const getCallState = () => ({
  conversationId: '3051234567',
  joinedAt: Date.now(),
  hasLocalAudio: boolean('hasLocalAudio', true),
  hasLocalVideo: boolean('hasLocalVideo', false),
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
  // We allow `any` here because this is fake and actually comes from RingRTC, which we
  //   can't import.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getGroupCallVideoFrameSource: noop as any,
  hangUp: action('hang-up'),
  i18n,
  me: {
    color: select('Caller color', Colors, 'ultramarine' as ColorType),
    title: text('Caller Title', 'Morty Smith'),
  },
  renderDeviceSelection: () => <div />,
  setLocalAudio: action('set-local-audio'),
  setLocalPreview: action('set-local-preview'),
  setLocalVideo: action('set-local-video'),
  setRendererCanvas: action('set-renderer-canvas'),
  startCall: action('start-call'),
  toggleParticipants: action('toggle-participants'),
  togglePip: action('toggle-pip'),
  toggleSettings: action('toggle-settings'),
});

const story = storiesOf('Components/CallManager', module);

story.add('No Call', () => <CallManager {...createProps()} />);

story.add('Ongoing Direct Call', () => (
  <CallManager
    {...createProps({
      activeCall: {
        call: {
          callMode: CallMode.Direct as CallMode.Direct,
          conversationId: '3051234567',
          callState: CallState.Accepted,
          isIncoming: false,
          isVideoCall: true,
          hasRemoteVideo: true,
        },
        activeCallState: getCallState(),
        conversation: getConversation(),
        isCallFull: false,
        groupCallPeekedParticipants: [],
        groupCallParticipants: [],
      },
    })}
  />
));

story.add('Ongoing Group Call', () => (
  <CallManager
    {...createProps({
      activeCall: {
        call: {
          callMode: CallMode.Group as CallMode.Group,
          conversationId: '3051234567',
          connectionState: GroupCallConnectionState.Connected,
          joinState: GroupCallJoinState.Joined,
          peekInfo: {
            conversationIds: [],
            maxDevices: 16,
            deviceCount: 0,
          },
          remoteParticipants: [],
        },
        activeCallState: getCallState(),
        conversation: getConversation(),
        isCallFull: false,
        groupCallPeekedParticipants: [],
        groupCallParticipants: [],
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
        call: getIncomingCallState({
          callEndedReason: CallEndedReason.RemoteHangupNeedPermission,
        }),
        activeCallState: getCallState(),
        conversation: getConversation(),
        isCallFull: false,
        groupCallPeekedParticipants: [],
        groupCallParticipants: [],
      },
    })}
  />
));
