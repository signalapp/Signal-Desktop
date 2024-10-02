// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { times } from 'lodash';
import { action } from '@storybook/addon-actions';
import { v4 as generateUuid } from 'uuid';

import type { Meta } from '@storybook/react';
import { AvatarColors } from '../types/Colors';
import type { ConversationType } from '../state/ducks/conversations';
import type { PropsType } from './CallingLobby';
import { CallingLobby as UnwrappedCallingLobby } from './CallingLobby';
import { setupI18n } from '../util/setupI18n';
import { generateAci } from '../types/ServiceId';
import enMessages from '../../_locales/en/messages.json';
import {
  getDefaultConversation,
  getDefaultConversationWithServiceId,
} from '../test-both/helpers/getDefaultConversation';
import { CallingToastProvider } from './CallingToast';
import { CallMode } from '../types/CallDisposition';
import { getDefaultCallLinkConversation } from '../test-both/helpers/fakeCallLink';

const i18n = setupI18n('en', enMessages);

const camera = {
  deviceId: 'dfbe6effe70b0611ba0fdc2a9ea3f39f6cb110e6687948f7e5f016c111b7329c',
  groupId: '63ee218d2446869e40adfc958ff98263e51f74382b0143328ee4826f20a76f47',
  kind: 'videoinput' as MediaDeviceKind,
  label: 'FaceTime HD Camera (Built-in) (9fba:bced)',
  toJSON() {
    return '';
  },
};

const getConversation = (callMode: CallMode) => {
  if (callMode === CallMode.Group) {
    return getDefaultConversation({
      title: 'Tahoe Trip',
      type: 'group',
    });
  }

  if (callMode === CallMode.Adhoc) {
    return getDefaultCallLinkConversation();
  }

  return getDefaultConversation();
};

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => {
  const callMode = overrideProps.callMode ?? CallMode.Direct;
  const conversation = getConversation(callMode);

  return {
    availableCameras: overrideProps.availableCameras || [camera],
    callMode,
    conversation,
    groupMembers:
      overrideProps.groupMembers ||
      (callMode === CallMode.Group
        ? times(3, () => getDefaultConversation())
        : undefined),
    hasLocalAudio: overrideProps.hasLocalAudio ?? true,
    hasLocalVideo: overrideProps.hasLocalVideo ?? false,
    i18n,
    isAdhocAdminApprovalRequired:
      overrideProps.isAdhocAdminApprovalRequired ?? false,
    isAdhocJoinRequestPending: overrideProps.isAdhocJoinRequestPending ?? false,
    isConversationTooBigToRing: false,
    isCallFull: overrideProps.isCallFull ?? false,
    getIsSharingPhoneNumberWithEverybody:
      overrideProps.getIsSharingPhoneNumberWithEverybody ?? (() => false),
    me:
      overrideProps.me ||
      getDefaultConversation({
        color: AvatarColors[0],
        id: generateUuid(),
        serviceId: generateAci(),
      }),
    onCallCanceled: action('on-call-canceled'),
    onJoinCall: action('on-join-call'),
    outgoingRing: overrideProps.outgoingRing ?? false,
    peekedParticipants: overrideProps.peekedParticipants || [],
    setLocalAudio: action('set-local-audio'),
    setLocalPreviewContainer: action('set-local-preview-container'),
    setLocalVideo: action('set-local-video'),
    setOutgoingRing: action('set-outgoing-ring'),
    showParticipantsList: overrideProps.showParticipantsList ?? false,
    toggleParticipants: action('toggle-participants'),
    togglePip: action('toggle-pip'),
    toggleSettings: action('toggle-settings'),
  };
};

function CallingLobby(props: ReturnType<typeof createProps>) {
  return (
    <CallingToastProvider i18n={i18n}>
      <UnwrappedCallingLobby {...props} />
    </CallingToastProvider>
  );
}

const fakePeekedParticipant = (conversationProps: Partial<ConversationType>) =>
  getDefaultConversationWithServiceId({
    ...conversationProps,
  });

export default {
  title: 'Components/CallingLobby',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  const props = createProps();
  return <CallingLobby {...props} />;
}

export function NoCameraNoAvatar(): JSX.Element {
  const props = createProps({
    availableCameras: [],
  });
  return <CallingLobby {...props} />;
}

export function NoCameraLocalAvatar(): JSX.Element {
  const props = createProps({
    availableCameras: [],
    me: getDefaultConversation({
      avatarUrl: '/fixtures/kitten-4-112-112.jpg',
      color: AvatarColors[0],
      id: generateUuid(),
      serviceId: generateAci(),
    }),
  });
  return <CallingLobby {...props} />;
}

export function LocalVideo(): JSX.Element {
  const props = createProps({
    hasLocalVideo: true,
  });
  return <CallingLobby {...props} />;
}

export function InitiallyMuted(): JSX.Element {
  const props = createProps({
    hasLocalAudio: false,
  });
  return <CallingLobby {...props} />;
}

export function GroupCallWithNoPeekedParticipants(): JSX.Element {
  const props = createProps({
    callMode: CallMode.Group,
    peekedParticipants: [],
  });
  return <CallingLobby {...props} />;
}

export function GroupCallWith1PeekedParticipant(): JSX.Element {
  const props = createProps({
    callMode: CallMode.Group,
    peekedParticipants: [{ title: 'Sam' }].map(fakePeekedParticipant),
  });
  return <CallingLobby {...props} />;
}

export function GroupCallWith1PeekedParticipantSelf(): JSX.Element {
  const serviceId = generateAci();
  const props = createProps({
    callMode: CallMode.Group,
    me: getDefaultConversation({
      id: generateUuid(),
      serviceId,
    }),
    peekedParticipants: [fakePeekedParticipant({ title: 'Ash', serviceId })],
  });
  return <CallingLobby {...props} />;
}

export function GroupCallWith4PeekedParticipants(): JSX.Element {
  const props = createProps({
    callMode: CallMode.Group,
    peekedParticipants: ['Sam', 'Cayce', 'April', 'Logan', 'Carl'].map(title =>
      fakePeekedParticipant({ title })
    ),
  });
  return <CallingLobby {...props} />;
}

export function GroupCallWith4PeekedParticipantsParticipantsList(): JSX.Element {
  const props = createProps({
    callMode: CallMode.Group,
    peekedParticipants: ['Sam', 'Cayce', 'April', 'Logan', 'Carl'].map(title =>
      fakePeekedParticipant({ title })
    ),
    showParticipantsList: true,
  });
  return <CallingLobby {...props} />;
}

export function GroupCallWithCallFull(): JSX.Element {
  const props = createProps({
    callMode: CallMode.Group,
    isCallFull: true,
    peekedParticipants: ['Sam', 'Cayce'].map(title =>
      fakePeekedParticipant({ title })
    ),
  });
  return <CallingLobby {...props} />;
}

export function GroupCallWith0PeekedParticipantsBigGroup(): JSX.Element {
  const props = createProps({
    callMode: CallMode.Group,
    groupMembers: times(100, () => getDefaultConversation()),
  });
  return <CallingLobby {...props} />;
}

export function CallLink(): JSX.Element {
  const props = createProps({
    callMode: CallMode.Adhoc,
  });
  return <CallingLobby {...props} />;
}

// Due to storybook font loading, if you directly load this story then
// the button width is not calculated correctly
export function CallLinkAdminApproval(): JSX.Element {
  const props = createProps({
    callMode: CallMode.Adhoc,
    isAdhocAdminApprovalRequired: true,
  });
  return <CallingLobby {...props} />;
}

export function CallLinkJoinRequestPending(): JSX.Element {
  const props = createProps({
    callMode: CallMode.Adhoc,
    isAdhocAdminApprovalRequired: true,
    isAdhocJoinRequestPending: true,
  });
  return <CallingLobby {...props} />;
}
