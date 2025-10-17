// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import lodash from 'lodash';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { AvatarColors } from '../types/Colors.std.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import type { PropsType } from './CallingPip.dom.js';
import { CallingPip } from './CallingPip.dom.js';
import type { ActiveDirectCallType } from '../types/Calling.std.js';
import {
  CallViewMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling.std.js';
import { CallMode } from '../types/CallDisposition.std.js';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.js';
import { fakeGetGroupCallVideoFrameSource } from '../test-helpers/fakeGetGroupCallVideoFrameSource.std.js';
import { MINUTE } from '../util/durations/index.std.js';
import type { SetRendererCanvasType } from '../state/ducks/calling.preload.js';
import { createCallParticipant } from '../test-helpers/createCallParticipant.std.js';

const { times } = lodash;

const { i18n } = window.SignalContext;

const videoScreenshot = new Image(300, 400);
videoScreenshot.src = '../../fixtures/cat-screenshot-3x4.png';
const localPreviewVideo = document.createElement('video');
localPreviewVideo.autoplay = true;
localPreviewVideo.loop = true;
localPreviewVideo.src = '../../fixtures/pixabay-Soap-Bubble-7141.mp4';

const conversation: ConversationType = getDefaultConversation({
  id: '3051234567',
  avatarUrl: undefined,
  color: AvatarColors[0],
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
  profileName: 'Rick Sanchez',
});

type Overrides = {
  hasLocalAudio?: boolean;
  hasLocalVideo?: boolean;
  localAudioLevel?: number;
  viewMode?: CallViewMode;
};

const getCommonActiveCallData = (overrides: Overrides) => ({
  conversation,
  hasLocalAudio: overrides.hasLocalAudio ?? true,
  hasLocalVideo: overrides.hasLocalVideo ?? true,
  localAudioLevel: overrides.localAudioLevel ?? 0,
  viewMode: overrides.viewMode ?? CallViewMode.Paginated,
  joinedAt: Date.now() - MINUTE,
  outgoingRing: true,
  pip: true,
  selfViewExpanded: false,
  settingsDialogOpen: false,
  showParticipantsList: false,
});

const getDefaultCall = (overrides: Overrides): ActiveDirectCallType => {
  return {
    ...getCommonActiveCallData(overrides),
    callMode: CallMode.Direct as CallMode.Direct,
    callState: CallState.Accepted,
    peekedParticipants: [],
    hasRemoteAudio: true,
    hasRemoteVideo: true,
    remoteAudioLevel: 0,
    remoteParticipants: [
      { hasRemoteVideo: true, presenting: false, title: 'Arsene' },
    ],
  };
};

export default {
  title: 'Components/CallingPip',
  args: {
    activeCall: getDefaultCall({}),
    getGroupCallVideoFrameSource: fakeGetGroupCallVideoFrameSource,
    hangUpActiveCall: action('hang-up-active-call'),
    i18n,
    me: getDefaultConversation({
      name: 'Lonely InGroup',
      title: 'Lonely InGroup',
    }),
    setGroupCallVideoRequest: action('set-group-call-video-request'),
    setLocalPreviewContainer: (container: HTMLDivElement | null) => {
      container?.appendChild(localPreviewVideo);
    },
    setRendererCanvas: ({ element }: SetRendererCanvasType) => {
      element?.current?.getContext('2d')?.drawImage(videoScreenshot, 0, 0);
    },
    switchFromPresentationView: action('switch-to-presentation-view'),
    switchToPresentationView: action('switch-to-presentation-view'),
    toggleAudio: action('toggle-audio'),
    togglePip: action('toggle-pip'),
    toggleVideo: action('toggle-video'),
  },
} satisfies Meta<PropsType>;

export function Default(args: PropsType): JSX.Element {
  return <CallingPip {...args} />;
}

// Note: should NOT show speaking indicators
export function DefaultBothSpeaking(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getDefaultCall({}),
        remoteAudioLevel: 0.75,
        localAudioLevel: 0.75,
      }}
    />
  );
}

// Note: should NOT show mute indicator for remote party
export function RemoteMuted(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getDefaultCall({}),
        hasRemoteAudio: false,
      }}
    />
  );
}

// Note: should NOT show show mute indicator in self preview
export function NoLocalAudio(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getDefaultCall({
          hasLocalAudio: false,
        }),
      }}
    />
  );
}

export function NoLocalVideo(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getDefaultCall({
          hasLocalVideo: false,
        }),
      }}
    />
  );
}

export function ContactWithAvatarAndNoVideo(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getDefaultCall({}),
        conversation: {
          ...conversation,
          avatarUrl: 'https://www.fillmurray.com/64/64',
        },
        remoteParticipants: [
          { hasRemoteVideo: false, presenting: false, title: 'Julian' },
        ],
      }}
    />
  );
}

export function ContactNoColor(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getDefaultCall({}),
        conversation: {
          ...conversation,
          color: undefined,
        },
      }}
    />
  );
}

export function LonelyInGroupCall(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getCommonActiveCallData({}),
        callMode: CallMode.Group as CallMode.Group,
        connectionState: GroupCallConnectionState.Connected,
        conversationsByDemuxId: new Map<number, ConversationType>(),
        groupMembers: times(3, () => getDefaultConversation()),
        isConversationTooBigToRing: false,
        joinState: GroupCallJoinState.Joined,
        localDemuxId: 1,
        maxDevices: 5,
        deviceCount: 0,
        peekedParticipants: [],
        pendingParticipants: [],
        raisedHands: new Set<number>(),
        remoteParticipants: [],
        remoteAudioLevels: new Map<number, number>(),
        suggestLowerHand: false,
      }}
    />
  );
}

export function LonelyInGroupCallVideoDisabled(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getCommonActiveCallData({
          hasLocalVideo: false,
        }),
        callMode: CallMode.Group as CallMode.Group,
        connectionState: GroupCallConnectionState.Connected,
        conversationsByDemuxId: new Map<number, ConversationType>(),
        groupMembers: times(3, () => getDefaultConversation()),
        isConversationTooBigToRing: false,
        joinState: GroupCallJoinState.Joined,
        localDemuxId: 1,
        maxDevices: 5,
        deviceCount: 0,
        peekedParticipants: [],
        pendingParticipants: [],
        raisedHands: new Set<number>(),
        remoteParticipants: [],
        remoteAudioLevels: new Map<number, number>(),
        suggestLowerHand: false,
      }}
    />
  );
}

export function GroupCall(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getCommonActiveCallData({}),
        callMode: CallMode.Group as CallMode.Group,
        connectionState: GroupCallConnectionState.Connected,
        conversationsByDemuxId: new Map<number, ConversationType>(),
        groupMembers: times(3, () => getDefaultConversation()),
        isConversationTooBigToRing: false,
        joinState: GroupCallJoinState.Joined,
        localDemuxId: 1,
        maxDevices: 5,
        deviceCount: 0,
        peekedParticipants: [],
        pendingParticipants: [],
        raisedHands: new Set<number>(),
        remoteParticipants: [
          createCallParticipant({}),
          createCallParticipant({}),
        ],
        remoteAudioLevels: new Map<number, number>(),
        suggestLowerHand: false,
      }}
    />
  );
}

export function GroupCallWithRaisedHands(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getCommonActiveCallData({}),
        callMode: CallMode.Group as CallMode.Group,
        connectionState: GroupCallConnectionState.Connected,
        conversationsByDemuxId: new Map<number, ConversationType>(),
        groupMembers: times(3, () => getDefaultConversation()),
        isConversationTooBigToRing: false,
        joinState: GroupCallJoinState.Joined,
        localDemuxId: 1,
        maxDevices: 5,
        deviceCount: 0,
        peekedParticipants: [],
        pendingParticipants: [],
        raisedHands: new Set<number>([1, 2, 3]),
        remoteParticipants: [
          createCallParticipant({}),
          createCallParticipant({}),
        ],
        remoteAudioLevels: new Map<number, number>(),
        suggestLowerHand: false,
      }}
    />
  );
}

export function GroupCallWithPendingParticipants(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getCommonActiveCallData({}),
        callMode: CallMode.Group as CallMode.Group,
        connectionState: GroupCallConnectionState.Connected,
        conversationsByDemuxId: new Map<number, ConversationType>(),
        groupMembers: times(3, () => getDefaultConversation()),
        isConversationTooBigToRing: false,
        joinState: GroupCallJoinState.Joined,
        localDemuxId: 1,
        maxDevices: 5,
        deviceCount: 0,
        peekedParticipants: [],
        pendingParticipants: [
          getDefaultConversation(),
          getDefaultConversation(),
        ],
        raisedHands: new Set<number>(),
        remoteParticipants: [
          createCallParticipant({}),
          createCallParticipant({}),
        ],
        remoteAudioLevels: new Map<number, number>(),
        suggestLowerHand: false,
      }}
    />
  );
}

export function GroupCallWithPendingAndRaised(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getCommonActiveCallData({}),
        callMode: CallMode.Group as CallMode.Group,
        connectionState: GroupCallConnectionState.Connected,
        conversationsByDemuxId: new Map<number, ConversationType>(),
        groupMembers: times(3, () => getDefaultConversation()),
        isConversationTooBigToRing: false,
        joinState: GroupCallJoinState.Joined,
        localDemuxId: 1,
        maxDevices: 5,
        deviceCount: 0,
        peekedParticipants: [],
        pendingParticipants: [
          getDefaultConversation(),
          getDefaultConversation(),
        ],
        raisedHands: new Set<number>([1, 2, 3]),
        remoteParticipants: [
          createCallParticipant({}),
          createCallParticipant({}),
        ],
        remoteAudioLevels: new Map<number, number>(),
        suggestLowerHand: false,
      }}
    />
  );
}

// Note: should NOT show muted indicator for remote party
export function GroupCallRemoteMuted(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getCommonActiveCallData({}),
        callMode: CallMode.Group as CallMode.Group,
        connectionState: GroupCallConnectionState.Connected,
        conversationsByDemuxId: new Map<number, ConversationType>(),
        groupMembers: times(3, () => getDefaultConversation()),
        isConversationTooBigToRing: false,
        joinState: GroupCallJoinState.Joined,
        localDemuxId: 1,
        maxDevices: 5,
        deviceCount: 0,
        peekedParticipants: [],
        pendingParticipants: [
          getDefaultConversation(),
          getDefaultConversation(),
        ],
        raisedHands: new Set<number>([1, 2, 3]),
        remoteParticipants: [
          {
            ...createCallParticipant({}),
            demuxId: 1,
            hasRemoteAudio: false,
            hasRemoteVideo: true,
            mediaKeysReceived: true,
          },
        ],
        remoteAudioLevels: new Map<number, number>(),
        suggestLowerHand: false,
      }}
    />
  );
}

// Note: should NOT show speaking indicator
export function GroupCallRemoteSpeaking(args: PropsType): JSX.Element {
  return (
    <CallingPip
      {...args}
      activeCall={{
        ...getCommonActiveCallData({}),
        callMode: CallMode.Group as CallMode.Group,
        connectionState: GroupCallConnectionState.Connected,
        conversationsByDemuxId: new Map<number, ConversationType>(),
        groupMembers: times(3, () => getDefaultConversation()),
        isConversationTooBigToRing: false,
        joinState: GroupCallJoinState.Joined,
        localDemuxId: 1,
        maxDevices: 5,
        deviceCount: 0,
        peekedParticipants: [],
        pendingParticipants: [
          getDefaultConversation(),
          getDefaultConversation(),
        ],
        raisedHands: new Set<number>([1, 2, 3]),
        remoteParticipants: [
          {
            ...createCallParticipant({}),
            demuxId: 1,
            hasRemoteAudio: true,
            hasRemoteVideo: true,
            mediaKeysReceived: true,
          },
        ],
        remoteAudioLevels: new Map<number, number>([[1, 0.75]]),
        suggestLowerHand: false,
      }}
    />
  );
}
