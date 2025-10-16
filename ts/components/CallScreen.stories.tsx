// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import lodash from 'lodash';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type {
  ActiveCallReactionsType,
  ActiveGroupCallType,
  GroupCallRemoteParticipantType,
  ObservedRemoteMuteType,
} from '../types/Calling.std.js';
import {
  CallViewMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling.std.js';
import { CallMode } from '../types/CallDisposition.std.js';
import { generateAci } from '../types/ServiceId.std.js';
import type { AciString } from '../types/ServiceId.std.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import { AvatarColors } from '../types/Colors.std.js';
import type { PropsType } from './CallScreen.dom.js';
import { CallScreen as UnwrappedCallScreen } from './CallScreen.dom.js';
import { DEFAULT_PREFERRED_REACTION_EMOJI } from '../reactions/constants.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import {
  getDefaultConversation,
  getDefaultConversationWithServiceId,
} from '../test-helpers/getDefaultConversation.std.js';
import { fakeGetGroupCallVideoFrameSource } from '../test-helpers/fakeGetGroupCallVideoFrameSource.std.js';
import { CallingToastProvider, useCallingToasts } from './CallingToast.dom.js';
import type { CallingImageDataCache } from './CallManager.dom.js';
import { MINUTE } from '../util/durations/index.std.js';

const { sample, shuffle, times } = lodash;

const MAX_PARTICIPANTS = 75;
const LOCAL_DEMUX_ID = 1;

const { i18n } = window.SignalContext;

const conversation = getDefaultConversation({
  id: '3051234567',
  avatarUrl: undefined,
  color: AvatarColors[0],
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
  profileName: 'Rick Sanchez',
  isMe: true,
});

type OverridePropsBase = {
  hasLocalAudio?: boolean;
  hasLocalVideo?: boolean;
  localAudioLevel?: number;
  viewMode?: CallViewMode;
  outgoingRing?: boolean;
  reactions?: ActiveCallReactionsType;
  myAci?: AciString;
  showNeedsScreenRecordingPermissionsWarning?: boolean;
};

type DirectCallOverrideProps = OverridePropsBase & {
  callMode: CallMode.Direct;
  callState?: CallState;
  hasRemoteVideo?: boolean;
  hasRemoteAudio?: boolean;
  outgoingRing?: boolean;
  selfViewExpanded?: boolean;
  remoteAudioLevel?: number;
};

type GroupCallOverrideProps = OverridePropsBase & {
  callMode: CallMode.Group | CallMode.Adhoc;
  connectionState?: GroupCallConnectionState;
  groupMembers?: Array<ConversationType>;
  peekedParticipants?: Array<ConversationType>;
  pendingParticipants?: Array<ConversationType>;
  raisedHands?: Set<number>;
  remoteAudioLevel?: number;
  remoteParticipants?: Array<GroupCallRemoteParticipantType>;
  selfViewExpanded?: boolean;
  suggestLowerHand?: boolean;
  outgoingRing?: boolean;
  localMutedBy?: number;
  observedRemoteMute?: ObservedRemoteMuteType;
  forceIndex0IsMe?: boolean;
};

const createActiveDirectCallProp = (
  overrideProps: DirectCallOverrideProps
) => ({
  callMode: CallMode.Direct as CallMode.Direct,
  conversation,
  callState: overrideProps.callState ?? CallState.Accepted,
  peekedParticipants: [] as [],
  remoteAudioLevel: overrideProps.remoteAudioLevel ?? 0,
  hasRemoteAudio: overrideProps.hasRemoteAudio ?? true,
  hasRemoteVideo: overrideProps.hasRemoteVideo ?? true,
  remoteParticipants: [
    {
      hasRemoteVideo: overrideProps.hasRemoteVideo ?? false,
      presenting: false,
      title: 'test',
    },
  ] as [
    {
      hasRemoteVideo: boolean;
      hasRemoteAudio: boolean;
      presenting: boolean;
      title: string;
    },
  ],
});

const getConversationsByDemuxId = (overrideProps: GroupCallOverrideProps) => {
  const conversationsByDemuxId = new Map<number, ConversationType>(
    overrideProps.remoteParticipants?.map((participant, index) => [
      participant.demuxId,
      getDefaultConversationWithServiceId(
        {
          isBlocked: index === 10 || index === MAX_PARTICIPANTS - 1,
          title: `Participant ${index + 1}`,
          isMe: index === 0 && (overrideProps.forceIndex0IsMe ?? false),
        },
        index === 0 && (overrideProps.forceIndex0IsMe ?? false)
          ? conversation.serviceId
          : undefined
      ),
    ])
  );
  conversationsByDemuxId.set(LOCAL_DEMUX_ID, conversation);
  return conversationsByDemuxId;
};

const getRaisedHands = (overrideProps: GroupCallOverrideProps) => {
  if (!overrideProps.remoteParticipants) {
    return;
  }

  return new Set<number>(
    overrideProps.remoteParticipants
      .filter(participant => participant.isHandRaised)
      .map(participant => participant.demuxId)
  );
};

const createActiveGroupCallProp = (overrideProps: GroupCallOverrideProps) => ({
  callMode: CallMode.Group as CallMode.Group,
  connectionState:
    overrideProps.connectionState || GroupCallConnectionState.Connected,
  conversationsByDemuxId: getConversationsByDemuxId(overrideProps),
  joinState: GroupCallJoinState.Joined,
  localDemuxId: LOCAL_DEMUX_ID,
  maxDevices: 5,
  deviceCount: (overrideProps.remoteParticipants || []).length,
  groupMembers:
    overrideProps.groupMembers || overrideProps.remoteParticipants || [],
  // Because remote participants are a superset, we can use them in place of peeked
  //   participants.
  isConversationTooBigToRing: false,
  peekedParticipants:
    overrideProps.peekedParticipants || overrideProps.remoteParticipants || [],
  pendingParticipants: overrideProps.pendingParticipants || [],
  raisedHands:
    overrideProps.raisedHands ||
    getRaisedHands(overrideProps) ||
    new Set<number>(),
  remoteParticipants: overrideProps.remoteParticipants || [],
  remoteAudioLevels: new Map<number, number>(
    overrideProps.remoteParticipants?.map((_participant, index) => [
      index,
      overrideProps.remoteAudioLevel ?? 0,
    ])
  ),
  reactions: overrideProps.reactions || [],
  suggestLowerHand: overrideProps.suggestLowerHand ?? false,
  mutedBy: overrideProps.localMutedBy ?? undefined,
  observedRemoteMute: overrideProps.observedRemoteMute ?? undefined,
});

const createActiveCallProp = (
  overrideProps: DirectCallOverrideProps | GroupCallOverrideProps
) => {
  const baseResult = {
    joinedAt: Date.now() - MINUTE,
    conversation,
    hasLocalAudio: overrideProps.hasLocalAudio ?? false,
    hasLocalVideo: overrideProps.hasLocalVideo ?? false,
    localAudioLevel: overrideProps.localAudioLevel ?? 0,
    viewMode: overrideProps.viewMode ?? CallViewMode.Sidebar,
    outgoingRing: overrideProps.outgoingRing ?? true,
    pip: false,
    settingsDialogOpen: false,
    selfViewExpanded: overrideProps.selfViewExpanded ?? false,
    showParticipantsList: false,
    showNeedsScreenRecordingPermissionsWarning:
      overrideProps.showNeedsScreenRecordingPermissionsWarning ?? false,
  };

  switch (overrideProps.callMode) {
    case CallMode.Direct:
      return { ...baseResult, ...createActiveDirectCallProp(overrideProps) };
    case CallMode.Group:
      return { ...baseResult, ...createActiveGroupCallProp(overrideProps) };
    case CallMode.Adhoc:
      return {
        ...baseResult,
        ...createActiveGroupCallProp(overrideProps),
        callMode: CallMode.Adhoc as CallMode.Adhoc,
      };
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
  approveUser: action('approve-user'),
  batchUserAction: action('batch-user-action'),
  changeCallView: action('change-call-view'),
  denyUser: action('deny-user'),
  getGroupCallVideoFrameSource: fakeGetGroupCallVideoFrameSource,
  getPresentingSources: action('get-presenting-sources'),
  hangUpActiveCall: action('hang-up'),
  i18n,
  imageDataCache: React.createRef<CallingImageDataCache>(),
  isCallLinkAdmin: true,
  me: getDefaultConversation({
    color: AvatarColors[1],
    id: '6146087e-f7ef-457e-9a8d-47df1fdd6b25',
    name: 'Morty Smith',
    profileName: 'Morty Smith',
    title: 'Morty Smith',
    serviceId: overrideProps.myAci ?? generateAci(),
  }),
  openSystemPreferencesAction: action('open-system-preferences-action'),
  renderReactionPicker: () => <div />,
  cancelPresenting: action('cancel-presenting'),
  sendGroupCallRaiseHand: action('send-group-call-raise-hand'),
  sendGroupCallReaction: action('send-group-call-reaction'),
  setGroupCallVideoRequest: action('set-group-call-video-request'),
  setLocalAudio: action('set-local-audio'),
  setLocalAudioRemoteMuted: action('set-local-audio-remote-muted'),
  setLocalPreviewContainer: action('set-local-preview-container'),
  setLocalVideo: action('set-local-video'),
  setRendererCanvas: action('set-renderer-canvas'),
  stickyControls: false,
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
});

function CallScreen(props: ReturnType<typeof createProps>): JSX.Element {
  return (
    <CallingToastProvider i18n={i18n}>
      <UnwrappedCallScreen {...props} />
    </CallingToastProvider>
  );
}

export default {
  title: 'Components/CallScreen',
  argTypes: {},
  args: {},
  excludeStories: ['allRemoteParticipants'],
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  return <CallScreen {...createProps()} />;
}

export function PreRing(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        callState: CallState.Prering,
      })}
    />
  );
}

export function DirectRinging(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        callState: CallState.Ringing,
      })}
    />
  );
}

export function Reconnecting(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        callState: CallState.Reconnecting,
      })}
    />
  );
}

export function Ended(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        callState: CallState.Ended,
      })}
    />
  );
}

export function HasLocalAudio(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        hasLocalAudio: true,
      })}
    />
  );
}

export function HasLocalVideo(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        hasLocalVideo: true,
      })}
    />
  );
}

export function HasRemoteVideo(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        hasRemoteVideo: true,
      })}
    />
  );
}

export function BothSpeaking(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        hasRemoteVideo: true,
        hasLocalAudio: true,
        localAudioLevel: 0.75,
        remoteAudioLevel: 0.75,
      })}
    />
  );
}

export function SelfViewExpanded(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        selfViewExpanded: true,
      })}
    />
  );
}

export function SelfViewExpandedBothSpeaking(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        selfViewExpanded: true,
        hasRemoteVideo: true,
        hasLocalAudio: true,
        localAudioLevel: 0.75,
        remoteAudioLevel: 0.75,
      })}
    />
  );
}

export function GroupCall1(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Group,
        remoteParticipants: [
          {
            aci: generateAci(),
            demuxId: 0,
            hasRemoteAudio: true,
            hasRemoteVideo: true,
            isHandRaised: false,
            mediaKeysReceived: true,
            presenting: false,
            sharingScreen: false,
            videoAspectRatio: 1.3,
            ...getDefaultConversation({
              isBlocked: false,
              serviceId: generateAci(),
              title: 'Tyler',
            }),
          },
        ],
      })}
    />
  );
}

export function GroupCall0(): JSX.Element {
  const props = createProps({
    callMode: CallMode.Group,
    remoteParticipants: [],
    groupMembers: [],
    outgoingRing: false,
  });
  return <CallScreen {...props} />;
}

export function GroupCallYourHandRaised(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Group,
        remoteParticipants: [
          {
            aci: generateAci(),
            demuxId: 0,
            hasRemoteAudio: true,
            hasRemoteVideo: true,
            isHandRaised: false,
            mediaKeysReceived: true,
            presenting: false,
            sharingScreen: false,
            videoAspectRatio: 1.3,
            ...getDefaultConversation({
              isBlocked: false,
              serviceId: generateAci(),
              title: 'Tyler',
            }),
          },
        ],
        raisedHands: new Set([LOCAL_DEMUX_ID]),
      })}
    />
  );
}

const PARTICIPANT_EMOJIS = ['❤️', '🤔', '✨', '😂', '🦄'] as const;

// We generate these upfront so that the list is stable when you move the slider.
export const allRemoteParticipants = times(MAX_PARTICIPANTS).map(index => {
  const mediaKeysReceived = (index + 1) % 20 !== 0;

  return {
    aci: generateAci(),
    addedTime: Date.now() - 60000,
    demuxId: index,
    hasRemoteAudio: mediaKeysReceived ? index % 3 !== 0 : false,
    hasRemoteVideo: mediaKeysReceived ? index % 4 !== 0 : false,
    isHandRaised: (index - 3) % 10 === 0,
    mediaKeysReceived,
    presenting: false,
    sharingScreen: false,
    videoAspectRatio: Math.random() < 0.7 ? 1.3 : Math.random() * 0.4 + 0.6,
    ...getDefaultConversationWithServiceId({
      isBlocked: index === 10 || index === MAX_PARTICIPANTS - 1,
      title: `Participant ${
        (index - 2) % 4 === 0
          ? PARTICIPANT_EMOJIS[
              Math.floor((index - 2) / 4) % PARTICIPANT_EMOJIS.length
            ]
          : ''
      } ${index + 1}`,
    }),
  };
});

export function GroupCallManyPaginated(): JSX.Element {
  const props = createProps({
    callMode: CallMode.Group,
    remoteParticipants: allRemoteParticipants,
    viewMode: CallViewMode.Paginated,
  });

  return <CallScreen {...props} />;
}
export function GroupCallManyPaginatedEveryoneTalking(): JSX.Element {
  const [props] = React.useState(
    createProps({
      callMode: CallMode.Group,
      remoteParticipants: allRemoteParticipants,
      viewMode: CallViewMode.Paginated,
    })
  );

  const activeCall = useMakeEveryoneTalk(
    props.activeCall as ActiveGroupCallType
  );

  return <CallScreen {...props} activeCall={activeCall} />;
}

export function GroupCallManyOverflow(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Group,
        remoteParticipants: allRemoteParticipants,
        viewMode: CallViewMode.Sidebar,
      })}
    />
  );
}

export function GroupCallManyOverflowEveryoneTalking(): JSX.Element {
  const [props] = React.useState(
    createProps({
      callMode: CallMode.Group,
      remoteParticipants: allRemoteParticipants,
      viewMode: CallViewMode.Sidebar,
    })
  );

  const activeCall = useMakeEveryoneTalk(
    props.activeCall as ActiveGroupCallType
  );

  return <CallScreen {...props} activeCall={activeCall} />;
}

export function GroupCallSpeakerView(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Group,
        viewMode: CallViewMode.Speaker,
        remoteParticipants: allRemoteParticipants.slice(0, 3),
      })}
    />
  );
}

export function GroupCallReconnecting(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Group,
        connectionState: GroupCallConnectionState.Reconnecting,
        remoteParticipants: [
          {
            aci: generateAci(),
            demuxId: 0,
            hasRemoteAudio: true,
            hasRemoteVideo: true,
            isHandRaised: false,
            mediaKeysReceived: true,
            presenting: false,
            sharingScreen: false,
            videoAspectRatio: 1.3,
            ...getDefaultConversation({
              isBlocked: false,
              title: 'Tyler',
              serviceId: generateAci(),
            }),
          },
        ],
      })}
    />
  );
}

export function GroupCallOutgoingRinging(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Group,
        remoteParticipants: [],
      })}
    />
  );
}

export function GroupCallSomeoneIsSharingScreen(): JSX.Element {
  return (
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
}

export function GroupCallSomeoneIsSharingScreenAndYoureReconnecting(): JSX.Element {
  return (
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
}

export function GroupCallSomeoneStoppedSharingScreen(): JSX.Element {
  const [remoteParticipants, setRemoteParticipants] = React.useState(
    allRemoteParticipants.slice(0, 5).map((participant, index) => ({
      ...participant,
      presenting: index === 1,
      sharingScreen: index === 1,
    }))
  );

  React.useEffect(() => {
    setTimeout(
      () => setRemoteParticipants(allRemoteParticipants.slice(0, 5)),
      1000
    );
  });

  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Group,
        remoteParticipants,
      })}
    />
  );
}

function ToastEmitter(): null {
  const { showToast } = useCallingToasts();
  const toastCount = React.useRef(0);
  React.useEffect(() => {
    const interval = setInterval(() => {
      const autoClose = toastCount.current % 2 === 0;
      showToast({
        key: Date.now().toString(),
        content: `${
          autoClose ? 'Disappearing' : 'Non-disappearing'
        } toast sent: ${Date.now()}`,
        dismissable: true,
        autoClose,
      });
      toastCount.current += 1;
    }, 1500);
    return () => clearInterval(interval);
  }, [showToast]);
  return null;
}

export function CallScreenToastAPalooza(): JSX.Element {
  return (
    <CallingToastProvider i18n={i18n}>
      <UnwrappedCallScreen {...createProps()} />
      <ToastEmitter />
    </CallingToastProvider>
  );
}

function useMakeEveryoneTalk(
  activeCall: ActiveGroupCallType,
  frequency = 2000
) {
  const [call, setCall] = React.useState(activeCall);
  React.useEffect(() => {
    const interval = setInterval(() => {
      const idxToStartSpeaking = Math.floor(
        Math.random() * call.remoteParticipants.length
      );

      const demuxIdToStartSpeaking = (
        call.remoteParticipants[
          idxToStartSpeaking
        ] as GroupCallRemoteParticipantType
      ).demuxId;

      const remoteAudioLevels = new Map();

      for (const [demuxId] of call.remoteAudioLevels.entries()) {
        if (demuxId === demuxIdToStartSpeaking) {
          remoteAudioLevels.set(demuxId, 1);
        } else {
          remoteAudioLevels.set(demuxId, 0);
        }
      }
      setCall(state => ({
        ...state,
        remoteParticipants: state.remoteParticipants.map((part, idx) => {
          return {
            ...part,
            hasRemoteAudio:
              idx === idxToStartSpeaking ? true : part.hasRemoteAudio,
            speakerTime:
              idx === idxToStartSpeaking
                ? Date.now()
                : (part as GroupCallRemoteParticipantType).speakerTime,
          };
        }),
        remoteAudioLevels,
      }));
    }, frequency);
    return () => clearInterval(interval);
  }, [frequency, call]);
  return call;
}

export function GroupCallReactions(): JSX.Element {
  const remoteParticipants = allRemoteParticipants.slice(0, 5);
  const [props] = React.useState(
    createProps({
      callMode: CallMode.Group,
      remoteParticipants,
      viewMode: CallViewMode.Sidebar,
    })
  );

  const activeCall = useReactionsEmitter({
    activeCall: props.activeCall as ActiveGroupCallType,
  });

  return <CallScreen {...props} activeCall={activeCall} />;
}

export function GroupCallReactionsSpam(): JSX.Element {
  const remoteParticipants = allRemoteParticipants.slice(0, 3);
  const [props] = React.useState(
    createProps({
      callMode: CallMode.Group,
      remoteParticipants,
      viewMode: CallViewMode.Sidebar,
    })
  );

  const activeCall = useReactionsEmitter({
    activeCall: props.activeCall as ActiveGroupCallType,
    frequency: 250,
  });

  return <CallScreen {...props} activeCall={activeCall} />;
}

export function GroupCallReactionsSkinTones(): JSX.Element {
  const remoteParticipants = allRemoteParticipants.slice(0, 3);
  const [props] = React.useState(
    createProps({
      callMode: CallMode.Group,
      remoteParticipants,
      viewMode: CallViewMode.Sidebar,
    })
  );

  const activeCall = useReactionsEmitter({
    activeCall: props.activeCall as ActiveGroupCallType,
    frequency: 500,
    emojis: ['👍', '👍🏻', '👍🏼', '👍🏽', '👍🏾', '👍🏿', '❤️', '😂', '😮', '😢'],
  });

  return <CallScreen {...props} activeCall={activeCall} />;
}

export function GroupCallReactionsManyInOrder(): JSX.Element {
  const timestamp = Date.now();
  const remoteParticipants = allRemoteParticipants.slice(0, 5);
  const reactions = remoteParticipants.map((participant, i) => {
    const { demuxId } = participant;
    const value =
      DEFAULT_PREFERRED_REACTION_EMOJI[
        i % DEFAULT_PREFERRED_REACTION_EMOJI.length
      ];
    return { timestamp, demuxId, value };
  });
  const [props] = React.useState(
    createProps({
      callMode: CallMode.Group,
      remoteParticipants,
      viewMode: CallViewMode.Sidebar,
      reactions,
    })
  );

  return <CallScreen {...props} />;
}

function useReactionsEmitter({
  activeCall,
  frequency = 2000,
  removeAfter = 5000,
  emojis = DEFAULT_PREFERRED_REACTION_EMOJI,
}: {
  activeCall: ActiveGroupCallType;
  frequency?: number;
  removeAfter?: number;
  emojis?: Array<string>;
}) {
  const [call, setCall] = React.useState(activeCall);
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCall(state => {
        const timeNow = Date.now();
        const expireAt = timeNow - removeAfter;

        const participantIndex = Math.floor(
          Math.random() * call.remoteParticipants.length
        );
        const { demuxId } = call.remoteParticipants[participantIndex];

        const reactions: ActiveCallReactionsType = [
          ...(state.reactions ?? []).filter(
            ({ timestamp }) => timestamp > expireAt
          ),
          {
            timestamp: timeNow,
            demuxId,
            value: sample(emojis) as string,
          },
        ];

        return {
          ...state,
          reactions,
        };
      });
    }, frequency);
    return () => clearInterval(interval);
  }, [emojis, frequency, removeAfter, call]);
  return call;
}

export function GroupCallHandRaising(): JSX.Element {
  const remoteParticipants = allRemoteParticipants.slice(0, 10);
  const [props] = React.useState(
    createProps({
      callMode: CallMode.Group,
      remoteParticipants,
      viewMode: CallViewMode.Sidebar,
    })
  );

  const activeCall = useHandRaiser(props.activeCall as ActiveGroupCallType);

  return <CallScreen {...props} activeCall={activeCall} />;
}

export function GroupCallSuggestLowerHand(): JSX.Element {
  const remoteParticipants = allRemoteParticipants.slice(0, 10);

  const [props, setProps] = React.useState(
    createProps({
      callMode: CallMode.Group,
      remoteParticipants,
      raisedHands: new Set([LOCAL_DEMUX_ID]),
      viewMode: CallViewMode.Sidebar,
      suggestLowerHand: false,
    })
  );

  React.useEffect(() => {
    setTimeout(
      () =>
        setProps(
          createProps({
            callMode: CallMode.Group,
            remoteParticipants,
            viewMode: CallViewMode.Sidebar,
            suggestLowerHand: true,
          })
        ),
      200
    );
  }, [remoteParticipants]);

  return <CallScreen {...props} />;
}

// Every [frequency] ms, all hands are lowered and [random min to max] random hands
// are raised
function useHandRaiser(
  activeCall: ActiveGroupCallType,
  frequency = 3000,
  min = 0,
  max = 5
) {
  const [call, setCall] = React.useState(activeCall);
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCall(state => {
        const participantsCount = call.remoteParticipants.length;
        const usableMax = Math.min(max, participantsCount);
        const raiseCount = Math.floor(min + (usableMax - min) * Math.random());
        const participantIndices = shuffle(
          Array.from(Array(participantsCount).keys())
        ).slice(0, raiseCount);

        const participantIndicesSet = new Set(participantIndices);
        const remoteParticipants = [...call.remoteParticipants].map(
          (participant, index) => {
            return {
              ...participant,
              isHandRaised: participantIndicesSet.has(index),
            };
          }
        );

        const raisedHands = new Set(
          participantIndices.map(
            index => call.remoteParticipants[index].demuxId
          )
        );

        return {
          ...state,
          remoteParticipants,
          raisedHands,
        };
      });
    }, frequency);
    return () => clearInterval(interval);
  }, [frequency, call, max, min]);
  return call;
}

export function GroupCallSomeoneMissingMediaKeys(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Group,
        remoteParticipants: allRemoteParticipants
          .slice(0, 5)
          .map((participant, index) => ({
            ...participant,
            addedTime: index === 1 ? Date.now() - 60000 : undefined,
            hasRemoteAudio: false,
            hasRemoteVideo: false,
            mediaKeysReceived: index !== 1,
          })),
      })}
    />
  );
}

export function GroupCallSomeoneBlocked(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Group,
        remoteParticipants: allRemoteParticipants
          .slice(0, 5)
          .map((participant, index) => ({
            ...participant,
            isBlocked: index === 1,
          })),
      })}
    />
  );
}

export function CallLinkUnknownContactMissingMediaKeys(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Adhoc,
        groupMembers: [],
        remoteParticipants: allRemoteParticipants
          .slice(0, 5)
          .map((participant, index) => ({
            ...participant,
            title: index === 1 ? 'Unknown Contact' : participant.title,
            titleNoDefault:
              index === 1 ? undefined : participant.titleNoDefault,
            addedTime: index === 1 ? Date.now() - 60000 : undefined,
            hasRemoteAudio: false,
            hasRemoteVideo: false,
            mediaKeysReceived: index !== 1,
          })),
      })}
    />
  );
}

export function RemoteMuteYouRemoteMutedByOther(): JSX.Element {
  // Should show you're muted by another
  const [props, setProps] = React.useState(() =>
    createProps({ callMode: CallMode.Group })
  );
  React.useEffect(() => {
    setProps(
      createProps({
        callMode: CallMode.Group,
        hasLocalAudio: false,
        remoteParticipants: allRemoteParticipants,
        localMutedBy: 3,
      })
    );
  }, []);
  return <CallScreen {...props} />;
}

export function RemoteMuteYouRemoteMutedBySelf(): JSX.Element {
  // Should show you're muted by yourself
  const [props, setProps] = React.useState(() =>
    createProps({ callMode: CallMode.Group })
  );
  const myAci = conversation.serviceId as AciString;
  React.useEffect(() => {
    setProps(
      createProps({
        callMode: CallMode.Group,
        remoteParticipants: [
          {
            aci: myAci,
            demuxId: 0,
            hasRemoteAudio: true,
            hasRemoteVideo: true,
            isHandRaised: false,
            mediaKeysReceived: true,
            presenting: false,
            sharingScreen: false,
            videoAspectRatio: 1.3,
            ...getDefaultConversation({
              isBlocked: false,
              title: 'Note To Self',
              serviceId: myAci,
              isMe: true,
            }),
          },
        ],
        localMutedBy: 0,
        myAci,
        forceIndex0IsMe: true,
      })
    );
  }, [myAci]);
  return <CallScreen {...props} />;
}

export function RemoteMuteObserveMuteYouSent(): JSX.Element {
  // Should show you muted someone else
  const [props, setProps] = React.useState(() =>
    createProps({ callMode: CallMode.Group })
  );
  React.useEffect(() => {
    setProps(
      createProps({
        callMode: CallMode.Group,
        remoteParticipants: allRemoteParticipants,
        observedRemoteMute: { source: LOCAL_DEMUX_ID, target: 0 },
      })
    );
  }, []);
  return <CallScreen {...props} />;
}

export function RemoteMuteObserveMuteOtherSent(): JSX.Element {
  // Should show someone else muted a third person
  const [props, setProps] = React.useState(() =>
    createProps({ callMode: CallMode.Group })
  );
  React.useEffect(() => {
    setProps(
      createProps({
        callMode: CallMode.Group,
        remoteParticipants: allRemoteParticipants,
        observedRemoteMute: { source: 3, target: 4 },
      })
    );
  }, []);
  return <CallScreen {...props} />;
}

export function RemoteMuteObserveIgnoreSelfMute(): JSX.Element {
  // Should show nothing because the ACIs match
  const [props, setProps] = React.useState(() =>
    createProps({ callMode: CallMode.Group })
  );
  const myAci = conversation.serviceId as AciString;
  React.useEffect(() => {
    setProps(
      createProps({
        callMode: CallMode.Group,
        remoteParticipants: [
          {
            aci: myAci,
            demuxId: 0,
            hasRemoteAudio: true,
            hasRemoteVideo: true,
            isHandRaised: false,
            mediaKeysReceived: true,
            presenting: false,
            sharingScreen: false,
            videoAspectRatio: 1.3,
            ...getDefaultConversation({
              isBlocked: false,
              title: 'Note To Self',
              serviceId: myAci,
              isMe: true,
            }),
          },
        ],
        observedRemoteMute: { source: LOCAL_DEMUX_ID, target: 0 },
        myAci,
        forceIndex0IsMe: true,
      })
    );
  }, [myAci]);
  return <CallScreen {...props} />;
}

export function ShowNeedsScreenRecordingPermissionsWarning(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Direct,
        showNeedsScreenRecordingPermissionsWarning: true,
      })}
    />
  );
}
