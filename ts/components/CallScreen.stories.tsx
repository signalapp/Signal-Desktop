// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { times } from 'lodash';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { GroupCallRemoteParticipantType } from '../types/Calling';
import {
  CallMode,
  CallViewMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling';
import { generateAci } from '../types/ServiceId';
import type { ConversationType } from '../state/ducks/conversations';
import { AvatarColors } from '../types/Colors';
import type { PropsType } from './CallScreen';
import { CallScreen as UnwrappedCallScreen } from './CallScreen';
import { setupI18n } from '../util/setupI18n';
import { missingCaseError } from '../util/missingCaseError';
import {
  getDefaultConversation,
  getDefaultConversationWithServiceId,
} from '../test-both/helpers/getDefaultConversation';
import { fakeGetGroupCallVideoFrameSource } from '../test-both/helpers/fakeGetGroupCallVideoFrameSource';
import enMessages from '../../_locales/en/messages.json';
import { CallingToastProvider, useCallingToasts } from './CallingToast';

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
  remoteAudioLevel?: number;
};

const createActiveDirectCallProp = (
  overrideProps: DirectCallOverrideProps
) => ({
  callMode: CallMode.Direct as CallMode.Direct,
  conversation,
  callState: overrideProps.callState ?? CallState.Accepted,
  peekedParticipants: [] as [],
  remoteParticipants: [
    {
      hasRemoteVideo: overrideProps.hasRemoteVideo ?? false,
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
  isConversationTooBigToRing: false,
  peekedParticipants:
    overrideProps.peekedParticipants || overrideProps.remoteParticipants || [],
  remoteParticipants: overrideProps.remoteParticipants || [],
  remoteAudioLevels: new Map<number, number>(
    overrideProps.remoteParticipants?.map((_participant, index) => [
      index,
      overrideProps.remoteAudioLevel ?? 0,
    ])
  ),
});

const createActiveCallProp = (
  overrideProps: DirectCallOverrideProps | GroupCallOverrideProps
) => {
  const baseResult = {
    joinedAt: Date.now(),
    conversation,
    hasLocalAudio: overrideProps.hasLocalAudio ?? false,
    hasLocalVideo: overrideProps.hasLocalVideo ?? false,
    localAudioLevel: overrideProps.localAudioLevel ?? 0,
    viewMode: overrideProps.viewMode ?? CallViewMode.Grid,
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
    serviceId: generateAci(),
  }),
  openSystemPreferencesAction: action('open-system-preferences-action'),
  setGroupCallVideoRequest: action('set-group-call-video-request'),
  setLocalAudio: action('set-local-audio'),
  setLocalPreview: action('set-local-preview'),
  setLocalVideo: action('set-local-video'),
  setPresenting: action('toggle-presenting'),
  setRendererCanvas: action('set-renderer-canvas'),
  stickyControls: false,
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

export function Ringing(): JSX.Element {
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

// We generate these upfront so that the list is stable when you move the slider.
const allRemoteParticipants = times(MAX_PARTICIPANTS).map(index => ({
  aci: generateAci(),
  demuxId: index,
  hasRemoteAudio: index % 3 !== 0,
  hasRemoteVideo: index % 4 !== 0,
  presenting: false,
  sharingScreen: false,
  videoAspectRatio: 1.3,
  ...getDefaultConversationWithServiceId({
    isBlocked: index === 10 || index === MAX_PARTICIPANTS - 1,
    title: `Participant ${index + 1}`,
  }),
}));

export function GroupCallMany(): JSX.Element {
  return (
    <CallScreen
      {...createProps({
        callMode: CallMode.Group,
        remoteParticipants: allRemoteParticipants.slice(0, 40),
      })}
    />
  );
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

export function GroupCall0(): JSX.Element {
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
