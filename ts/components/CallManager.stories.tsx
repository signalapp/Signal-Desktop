// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { noop } from 'lodash';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { CallManager, PropsType } from './CallManager';
import {
  CallEndedReason,
  CallMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling';
import { ConversationTypeType } from '../state/ducks/conversations';
import { ColorType } from '../types/Colors';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const conversation = {
  id: '3051234567',
  avatarPath: undefined,
  color: 'ultramarine' as ColorType,
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
  profileName: 'Rick Sanchez',
  markedUnread: false,
  type: 'direct' as ConversationTypeType,
  lastUpdated: Date.now(),
};

const defaultProps = {
  availableCameras: [],
  acceptCall: action('accept-call'),
  cancelCall: action('cancel-call'),
  closeNeedPermissionScreen: action('close-need-permission-screen'),
  declineCall: action('decline-call'),
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
  i18n,
  me: {
    color: 'ultramarine' as ColorType,
    title: 'Morty Smith',
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
};

const permutations = [
  {
    title: 'Call Manager (no call)',
    props: {},
  },
  {
    title: 'Call Manager (ongoing direct call)',
    props: {
      activeCall: {
        call: {
          callMode: CallMode.Direct as CallMode.Direct,
          conversationId: '3051234567',
          callState: CallState.Accepted,
          isIncoming: false,
          isVideoCall: true,
          hasRemoteVideo: true,
        },
        activeCallState: {
          conversationId: '3051234567',
          joinedAt: Date.now(),
          hasLocalAudio: true,
          hasLocalVideo: false,
          participantsList: false,
          pip: false,
          settingsDialogOpen: false,
        },
        conversation,
      },
    },
  },
  {
    title: 'Call Manager (ongoing group call)',
    props: {
      activeCall: {
        call: {
          callMode: CallMode.Group as CallMode.Group,
          conversationId: '3051234567',
          connectionState: GroupCallConnectionState.Connected,
          joinState: GroupCallJoinState.Joined,
          remoteParticipants: [],
        },
        activeCallState: {
          conversationId: '3051234567',
          joinedAt: Date.now(),
          hasLocalAudio: true,
          hasLocalVideo: false,
          participantsList: false,
          pip: false,
          settingsDialogOpen: false,
        },
        conversation,
      },
    },
  },
  {
    title: 'Call Manager (ringing)',
    props: {
      incomingCall: {
        call: {
          callMode: CallMode.Direct as CallMode.Direct,
          conversationId: '3051234567',
          callState: CallState.Ringing,
          isIncoming: true,
          isVideoCall: true,
          hasRemoteVideo: true,
        },
        conversation,
      },
    },
  },
  {
    title: 'Call Manager (call request needed)',
    props: {
      activeCall: {
        call: {
          callMode: CallMode.Direct as CallMode.Direct,
          conversationId: '3051234567',
          callState: CallState.Ended,
          callEndedReason: CallEndedReason.RemoteHangupNeedPermission,
          isIncoming: false,
          isVideoCall: true,
          hasRemoteVideo: true,
        },
        activeCallState: {
          conversationId: '3051234567',
          joinedAt: Date.now(),
          hasLocalAudio: true,
          hasLocalVideo: false,
          participantsList: false,
          pip: false,
          settingsDialogOpen: false,
        },
        conversation,
      },
    },
  },
];

storiesOf('Components/CallManager', module).add('Iterations', () => {
  return permutations.map(
    ({ props, title }: { props: Partial<PropsType>; title: string }) => (
      <>
        <h3>{title}</h3>
        <CallManager {...defaultProps} {...props} />
      </>
    )
  );
});
