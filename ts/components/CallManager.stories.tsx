// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './CallManager';
import { CallManager } from './CallManager';
import {
  type ActiveGroupCallType,
  CallEndedReason,
  CallMode,
  CallState,
  CallViewMode,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling';
import type {
  ConversationType,
  ConversationTypeType,
} from '../state/ducks/conversations';
import { AvatarColors } from '../types/Colors';
import { generateAci } from '../types/ServiceId';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { fakeGetGroupCallVideoFrameSource } from '../test-both/helpers/fakeGetGroupCallVideoFrameSource';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { StorySendMode } from '../types/Stories';
import {
  FAKE_CALL_LINK,
  getDefaultCallLinkConversation,
} from '../test-both/helpers/fakeCallLink';
import { allRemoteParticipants } from './CallScreen.stories';
import { getPlaceholderContact } from '../state/selectors/conversations';

const i18n = setupI18n('en', enMessages);

const getConversation = () =>
  getDefaultConversation({
    id: '3051234567',
    avatarPath: undefined,
    color: AvatarColors[0],
    title: 'Rick Sanchez',
    name: 'Rick Sanchez',
    phoneNumber: '3051234567',
    profileName: 'Rick Sanchez',
    markedUnread: false,
    type: 'direct' as ConversationTypeType,
    lastUpdated: Date.now(),
  });

const getUnknownContact = (): ConversationType => ({
  ...getPlaceholderContact(),
  serviceId: generateAci(),
});

const getCommonActiveCallData = () => ({
  conversation: getConversation(),
  joinedAt: Date.now(),
  hasLocalAudio: true,
  hasLocalVideo: false,
  localAudioLevel: 0,
  viewMode: CallViewMode.Paginated,
  outgoingRing: true,
  pip: false,
  settingsDialogOpen: false,
  showParticipantsList: false,
});

const createProps = (storyProps: Partial<PropsType> = {}): PropsType => ({
  ...storyProps,
  availableCameras: [],
  acceptCall: action('accept-call'),
  approveUser: action('approve-user'),
  bounceAppIconStart: action('bounce-app-icon-start'),
  bounceAppIconStop: action('bounce-app-icon-stop'),
  cancelCall: action('cancel-call'),
  changeCallView: action('change-call-view'),
  closeNeedPermissionScreen: action('close-need-permission-screen'),
  declineCall: action('decline-call'),
  denyUser: action('deny-user'),
  getGroupCallVideoFrameSource: (_: string, demuxId: number) =>
    fakeGetGroupCallVideoFrameSource(demuxId),
  getIsSharingPhoneNumberWithEverybody: () => false,
  getPresentingSources: action('get-presenting-sources'),
  hangUpActiveCall: action('hang-up-active-call'),
  hasInitialLoadCompleted: true,
  i18n,
  incomingCall: null,
  callLink: storyProps.callLink ?? undefined,
  isGroupCallRaiseHandEnabled: true,
  me: {
    ...getDefaultConversation({
      color: AvatarColors[0],
      title: 'Morty Smith',
    }),
    serviceId: generateAci(),
  },
  notifyForCall: action('notify-for-call'),
  openSystemPreferencesAction: action('open-system-preferences-action'),
  playRingtone: action('play-ringtone'),
  removeClient: action('remove-client'),
  renderDeviceSelection: () => <div />,
  renderEmojiPicker: () => <>EmojiPicker</>,
  renderReactionPicker: () => <div />,
  sendGroupCallRaiseHand: action('send-group-call-raise-hand'),
  sendGroupCallReaction: action('send-group-call-reaction'),
  setGroupCallVideoRequest: action('set-group-call-video-request'),
  setIsCallActive: action('set-is-call-active'),
  setLocalAudio: action('set-local-audio'),
  setLocalPreview: action('set-local-preview'),
  setLocalVideo: action('set-local-video'),
  setPresenting: action('toggle-presenting'),
  setRendererCanvas: action('set-renderer-canvas'),
  setOutgoingRing: action('set-outgoing-ring'),
  showContactModal: action('show-contact-modal'),
  showShareCallLinkViaSignal: action('show-share-call-link-via-signal'),
  startCall: action('start-call'),
  stopRingtone: action('stop-ringtone'),
  switchToPresentationView: action('switch-to-presentation-view'),
  switchFromPresentationView: action('switch-from-presentation-view'),
  toggleParticipants: action('toggle-participants'),
  togglePip: action('toggle-pip'),
  toggleScreenRecordingPermissionsDialog: action(
    'toggle-screen-recording-permissions-dialog'
  ),
  toggleSettings: action('toggle-settings'),
  isConversationTooBigToRing: false,
  pauseVoiceNotePlayer: action('pause-audio-player'),
});

const getActiveCallForCallLink = (
  overrideProps: Partial<ActiveGroupCallType> = {}
): ActiveGroupCallType => {
  return {
    conversation: getDefaultCallLinkConversation(),
    joinedAt: Date.now(),
    hasLocalAudio: true,
    hasLocalVideo: true,
    localAudioLevel: 0,
    viewMode: CallViewMode.Paginated,
    outgoingRing: false,
    pip: false,
    settingsDialogOpen: false,
    showParticipantsList: overrideProps.showParticipantsList ?? true,
    callMode: CallMode.Adhoc,
    connectionState: GroupCallConnectionState.NotConnected,
    conversationsByDemuxId: new Map<number, ConversationType>(),
    deviceCount: 0,
    joinState: GroupCallJoinState.NotJoined,
    localDemuxId: 1,
    maxDevices: 5,
    groupMembers: [],
    isConversationTooBigToRing: false,
    peekedParticipants:
      overrideProps.peekedParticipants ?? allRemoteParticipants.slice(0, 3),
    remoteParticipants: overrideProps.remoteParticipants ?? [],
    pendingParticipants: [],
    raisedHands: new Set<number>(),
    remoteAudioLevels: new Map<number, number>(),
  };
};

export default {
  title: 'Components/CallManager',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

export function NoCall(): JSX.Element {
  return <CallManager {...createProps()} />;
}

export function OngoingDirectCall(): JSX.Element {
  return (
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
}

export function OngoingGroupCall(): JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: {
          ...getCommonActiveCallData(),
          callMode: CallMode.Group,
          connectionState: GroupCallConnectionState.Connected,
          conversationsByDemuxId: new Map<number, ConversationType>(),
          deviceCount: 0,
          joinState: GroupCallJoinState.Joined,
          localDemuxId: 1,
          maxDevices: 5,
          groupMembers: [],
          isConversationTooBigToRing: false,
          peekedParticipants: [],
          pendingParticipants: [],
          raisedHands: new Set<number>(),
          remoteParticipants: [],
          remoteAudioLevels: new Map<number, number>(),
        },
      })}
    />
  );
}

export function RingingDirectCall(): JSX.Element {
  return (
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
}

export function RingingGroupCall(): JSX.Element {
  return (
    <CallManager
      {...createProps({
        incomingCall: {
          callMode: CallMode.Group as const,
          connectionState: GroupCallConnectionState.NotConnected,
          joinState: GroupCallJoinState.NotJoined,
          conversation: {
            ...getConversation(),
            type: 'group',
            title: 'Tahoe Trip',
            acknowledgedGroupNameCollisions: {},
            storySendMode: StorySendMode.IfActive,
          },
          otherMembersRung: [
            { firstName: 'Morty', title: 'Morty Smith' },
            { firstName: 'Summer', title: 'Summer Smith' },
          ],
          ringer: { firstName: 'Rick', title: 'Rick Sanchez' },
          remoteParticipants: [],
        },
      })}
    />
  );
}

export function CallRequestNeeded(): JSX.Element {
  return (
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
}

export function CallLinkLobbyParticipantsKnown(): JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink(),
        callLink: FAKE_CALL_LINK,
      })}
    />
  );
}

export function CallLinkLobbyParticipants1Unknown(): JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          peekedParticipants: [getPlaceholderContact()],
        }),
        callLink: FAKE_CALL_LINK,
      })}
    />
  );
}

export function CallLinkLobbyParticipants1Known1Unknown(): JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          peekedParticipants: [allRemoteParticipants[0], getUnknownContact()],
        }),
        callLink: FAKE_CALL_LINK,
      })}
    />
  );
}

export function CallLinkLobbyParticipants1Known2Unknown(): JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          peekedParticipants: [
            getUnknownContact(),
            allRemoteParticipants[0],
            getUnknownContact(),
          ],
        }),
        callLink: FAKE_CALL_LINK,
      })}
    />
  );
}

export function CallLinkLobbyParticipants1Known12Unknown(): JSX.Element {
  const peekedParticipants: Array<ConversationType> = [
    allRemoteParticipants[0],
  ];
  for (let n = 12; n > 0; n -= 1) {
    peekedParticipants.push(getUnknownContact());
  }
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          peekedParticipants,
        }),
        callLink: FAKE_CALL_LINK,
      })}
    />
  );
}

export function CallLinkLobbyParticipants3Unknown(): JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          peekedParticipants: [
            getUnknownContact(),
            getUnknownContact(),
            getUnknownContact(),
          ],
        }),
        callLink: FAKE_CALL_LINK,
      })}
    />
  );
}
