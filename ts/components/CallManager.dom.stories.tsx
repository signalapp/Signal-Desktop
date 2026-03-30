// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './CallManager.dom.tsx';
import { CallManager } from './CallManager.dom.tsx';
import {
  CallEndedReason,
  CallState,
  CallViewMode,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling.std.ts';
import { CallMode } from '../types/CallDisposition.std.ts';
import type {
  ActiveGroupCallType,
  GroupCallRemoteParticipantType,
} from '../types/Calling.std.ts';
import type {
  ConversationType,
  ConversationTypeType,
} from '../state/ducks/conversations.preload.ts';
import { AvatarColors } from '../types/Colors.std.ts';
import { generateAci } from '../types/ServiceId.std.ts';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.ts';
import { fakeGetGroupCallVideoFrameSource } from '../test-helpers/fakeGetGroupCallVideoFrameSource.std.ts';
import { StorySendMode } from '../types/Stories.std.ts';
import {
  FAKE_CALL_LINK,
  FAKE_CALL_LINK_WITH_ADMIN_KEY,
  getDefaultCallLinkConversation,
} from '../test-helpers/fakeCallLink.std.ts';
import { allRemoteParticipants } from './CallScreen.dom.stories.tsx';

const { i18n } = window.SignalContext;

const [participant1, participant2, participant3, participant4] =
  allRemoteParticipants as [
    GroupCallRemoteParticipantType,
    GroupCallRemoteParticipantType,
    GroupCallRemoteParticipantType,
    GroupCallRemoteParticipantType,
  ];

const getConversation = () =>
  getDefaultConversation({
    id: '3051234567',
    avatarUrl: undefined,
    color: AvatarColors[0],
    title: 'Rick Sanchez',
    name: 'Rick Sanchez',
    phoneNumber: '3051234567',
    profileName: 'Rick Sanchez',
    markedUnread: false,
    type: 'direct' as ConversationTypeType,
    lastUpdated: Date.now(),
  });

const placeHolderContact: ConversationType = {
  acceptedMessageRequest: false,
  badges: [],
  id: '123',
  type: 'direct',
  title: i18n('icu:unknownContact'),
  isMe: false,
};

const getUnknownContact = (): ConversationType => ({
  ...placeHolderContact,
  serviceId: generateAci(),
});

const getUnknownParticipant = (): GroupCallRemoteParticipantType => ({
  ...placeHolderContact,
  serviceId: generateAci(),
  aci: generateAci(),
  demuxId: Math.round(10000 * Math.random()),
  hasRemoteAudio: true,
  hasRemoteVideo: true,
  isHandRaised: false,
  mediaKeysReceived: false,
  presenting: false,
  sharingScreen: false,
  videoAspectRatio: 1,
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
  selfViewExpanded: false,
  settingsDialogOpen: false,
  showParticipantsList: false,
});

const createProps = (storyProps: Partial<PropsType> = {}): PropsType => ({
  ...storyProps,
  availableCameras: [],
  acceptCall: action('accept-call'),
  activeNotificationProfile: undefined,
  approveUser: action('approve-user'),
  batchUserAction: action('batch-user-action'),
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
  isOnline: true,
  ringingCall: null,
  callLink: storyProps.callLink ?? undefined,
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
  cancelPresenting: action('cancel-presenting'),
  renderDeviceSelection: () => <div />,
  renderReactionPicker: () => <div />,
  sendGroupCallRaiseHand: action('send-group-call-raise-hand'),
  sendGroupCallReaction: action('send-group-call-reaction'),
  selectPresentingSource: action('select-presenting-source'),
  setGroupCallVideoRequest: action('set-group-call-video-request'),
  setIsCallActive: action('set-is-call-active'),
  setLocalAudio: action('set-local-audio'),
  setLocalAudioRemoteMuted: action('set-local-audio-remote-muted'),
  setLocalPreviewContainer: action('set-local-preview-container'),
  setLocalVideo: action('set-local-video'),
  setRendererCanvas: action('set-renderer-canvas'),
  setOutgoingRing: action('set-outgoing-ring'),
  showContactModal: action('show-contact-modal'),
  showShareCallLinkViaSignal: action('show-share-call-link-via-signal'),
  startCall: action('start-call'),
  stopRingtone: action('stop-ringtone'),
  switchToPresentationView: action('switch-to-presentation-view'),
  switchFromPresentationView: action('switch-from-presentation-view'),
  toggleCallLinkPendingParticipantModal: action(
    'toggle-call-link-pending-participant-modal'
  ),
  toggleParticipants: action('toggle-participants'),
  togglePip: action('toggle-pip'),
  toggleScreenRecordingPermissionsDialog: action(
    'toggle-screen-recording-permissions-dialog'
  ),
  toggleSelfViewExpanded: action('toggle-self-view-expanded'),
  toggleSettings: action('toggle-settings'),
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
    connectionState:
      overrideProps.connectionState ?? GroupCallConnectionState.NotConnected,
    conversationsByDemuxId: new Map<number, ConversationType>(),
    deviceCount: 0,
    joinState: overrideProps.joinState ?? GroupCallJoinState.NotJoined,
    localDemuxId: 1,
    maxDevices: 5,
    groupMembers: [],
    isConversationTooBigToRing: false,
    peekedParticipants:
      overrideProps.peekedParticipants ?? allRemoteParticipants.slice(0, 3),
    remoteParticipants: overrideProps.remoteParticipants ?? [],
    pendingParticipants: overrideProps.pendingParticipants ?? [],
    raisedHands: new Set<number>(),
    remoteAudioLevels: new Map<number, number>(),
    selfViewExpanded: false,
    suggestLowerHand: false,
  };
};

export default {
  title: 'Components/CallManager',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

export function NoCall(): React.JSX.Element {
  return <CallManager {...createProps()} />;
}

export function OngoingDirectCall(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: {
          ...getCommonActiveCallData(),
          callMode: CallMode.Direct,
          callState: CallState.Accepted,
          peekedParticipants: [],
          remoteAudioLevel: 0,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          remoteParticipants: [
            { hasRemoteVideo: true, presenting: false, title: 'Remy' },
          ],
        },
      })}
    />
  );
}

export function OngoingGroupCall(): React.JSX.Element {
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
          suggestLowerHand: false,
        },
      })}
    />
  );
}

export function RingingDirectCall(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        ringingCall: {
          callMode: CallMode.Direct as const,
          conversation: getConversation(),
          isVideoCall: true,
        },
      })}
    />
  );
}

export function RingingGroupCall(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        ringingCall: {
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

export function CallRequestNeeded(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: {
          ...getCommonActiveCallData(),
          callEndedReason: CallEndedReason.RemoteHangupNeedPermission,
          callMode: CallMode.Direct,
          callState: CallState.Accepted,
          peekedParticipants: [],
          remoteAudioLevel: 0,
          hasRemoteAudio: true,
          hasRemoteVideo: true,
          remoteParticipants: [
            { hasRemoteVideo: true, presenting: false, title: 'Mike' },
          ],
        },
      })}
    />
  );
}

export function CallLinkLobbyParticipantsKnown(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink(),
        callLink: FAKE_CALL_LINK,
      })}
    />
  );
}

export function CallLinkLobbyParticipants1Unknown(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          peekedParticipants: [placeHolderContact],
        }),
        callLink: FAKE_CALL_LINK,
      })}
    />
  );
}

export function CallLinkLobbyParticipants1Known1Unknown(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          peekedParticipants: [participant1, getUnknownContact()],
        }),
        callLink: FAKE_CALL_LINK,
      })}
    />
  );
}

export function CallLinkLobbyParticipants1Known2Unknown(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          peekedParticipants: [
            getUnknownContact(),
            participant1,
            getUnknownContact(),
          ],
        }),
        callLink: FAKE_CALL_LINK,
      })}
    />
  );
}

export function CallLinkLobbyParticipants1Known12Unknown(): React.JSX.Element {
  const peekedParticipants: Array<ConversationType> = [participant1];
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

export function CallLinkLobbyParticipants3Unknown(): React.JSX.Element {
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

export function CallLinkWithJoinRequestsOne(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          connectionState: GroupCallConnectionState.Connected,
          joinState: GroupCallJoinState.Joined,
          peekedParticipants: [participant1],
          pendingParticipants: [participant2],
          showParticipantsList: false,
        }),
        callLink: FAKE_CALL_LINK_WITH_ADMIN_KEY,
      })}
    />
  );
}

export function CallLinkWithJoinRequestsTwo(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          connectionState: GroupCallConnectionState.Connected,
          joinState: GroupCallJoinState.Joined,
          peekedParticipants: [participant1],
          pendingParticipants: allRemoteParticipants.slice(1, 3),
          showParticipantsList: false,
        }),
        callLink: FAKE_CALL_LINK_WITH_ADMIN_KEY,
      })}
    />
  );
}

export function CallLinkWithJoinRequestsMany(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          connectionState: GroupCallConnectionState.Connected,
          joinState: GroupCallJoinState.Joined,
          peekedParticipants: [participant1],
          pendingParticipants: allRemoteParticipants.slice(1, 11),
          showParticipantsList: false,
        }),
        callLink: FAKE_CALL_LINK_WITH_ADMIN_KEY,
      })}
    />
  );
}

export function CallLinkWithJoinRequestUnknownContact(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          connectionState: GroupCallConnectionState.Connected,
          joinState: GroupCallJoinState.Joined,
          peekedParticipants: [participant1],
          pendingParticipants: [
            getUnknownContact(),
            participant2,
            participant3,
          ],
          showParticipantsList: false,
        }),
        callLink: FAKE_CALL_LINK_WITH_ADMIN_KEY,
      })}
    />
  );
}

export function CallLinkWithJoinRequestsSystemContact(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          connectionState: GroupCallConnectionState.Connected,
          joinState: GroupCallJoinState.Joined,
          peekedParticipants: [participant1],
          pendingParticipants: [
            { ...participant2, name: 'My System Contact Friend' },
          ],
          showParticipantsList: false,
        }),
        callLink: FAKE_CALL_LINK_WITH_ADMIN_KEY,
      })}
    />
  );
}

export function CallLinkWithJoinRequestsSystemContactMany(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          connectionState: GroupCallConnectionState.Connected,
          joinState: GroupCallJoinState.Joined,
          peekedParticipants: [participant1],
          pendingParticipants: [
            { ...participant2, name: 'My System Contact Friend' },
            participant3,
            participant4,
          ],
          showParticipantsList: false,
        }),
        callLink: FAKE_CALL_LINK_WITH_ADMIN_KEY,
      })}
    />
  );
}

export function CallLinkWithJoinRequestsParticipantsOpen(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          connectionState: GroupCallConnectionState.Connected,
          joinState: GroupCallJoinState.Joined,
          peekedParticipants: [participant1],
          pendingParticipants: allRemoteParticipants.slice(1, 4),
        }),
        callLink: FAKE_CALL_LINK_WITH_ADMIN_KEY,
      })}
    />
  );
}

export function CallLinkWithUnknownContacts(): React.JSX.Element {
  return (
    <CallManager
      {...createProps({
        activeCall: getActiveCallForCallLink({
          connectionState: GroupCallConnectionState.Connected,
          joinState: GroupCallJoinState.Joined,
          remoteParticipants: [
            participant1,
            getUnknownParticipant(),
            getUnknownParticipant(),
          ],
        }),
        callLink: FAKE_CALL_LINK_WITH_ADMIN_KEY,
      })}
    />
  );
}
