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

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => {
  const isGroupCall = overrideProps.isGroupCall ?? false;
  const conversation = isGroupCall
    ? getDefaultConversation({
        title: 'Tahoe Trip',
        type: 'group',
      })
    : getDefaultConversation();

  return {
    availableCameras: overrideProps.availableCameras || [camera],
    conversation,
    groupMembers:
      overrideProps.groupMembers ||
      (isGroupCall ? times(3, () => getDefaultConversation()) : undefined),
    hasLocalAudio: overrideProps.hasLocalAudio ?? true,
    hasLocalVideo: overrideProps.hasLocalVideo ?? false,
    i18n,
    isGroupCall,
    isConversationTooBigToRing: false,
    isCallFull: overrideProps.isCallFull ?? false,
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
    setLocalPreview: action('set-local-preview'),
    setLocalVideo: action('set-local-video'),
    setOutgoingRing: action('set-outgoing-ring'),
    showParticipantsList: overrideProps.showParticipantsList ?? false,
    toggleParticipants: action('toggle-participants'),
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
      avatarPath: '/fixtures/kitten-4-112-112.jpg',
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
  const props = createProps({ isGroupCall: true, peekedParticipants: [] });
  return <CallingLobby {...props} />;
}

export function GroupCallWith1PeekedParticipant(): JSX.Element {
  const props = createProps({
    isGroupCall: true,
    peekedParticipants: [{ title: 'Sam' }].map(fakePeekedParticipant),
  });
  return <CallingLobby {...props} />;
}

export function GroupCallWith1PeekedParticipantSelf(): JSX.Element {
  const serviceId = generateAci();
  const props = createProps({
    isGroupCall: true,
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
    isGroupCall: true,
    peekedParticipants: ['Sam', 'Cayce', 'April', 'Logan', 'Carl'].map(title =>
      fakePeekedParticipant({ title })
    ),
  });
  return <CallingLobby {...props} />;
}

export function GroupCallWith4PeekedParticipantsParticipantsList(): JSX.Element {
  const props = createProps({
    isGroupCall: true,
    peekedParticipants: ['Sam', 'Cayce', 'April', 'Logan', 'Carl'].map(title =>
      fakePeekedParticipant({ title })
    ),
    showParticipantsList: true,
  });
  return <CallingLobby {...props} />;
}

export function GroupCallWithCallFull(): JSX.Element {
  const props = createProps({
    isGroupCall: true,
    isCallFull: true,
    peekedParticipants: ['Sam', 'Cayce'].map(title =>
      fakePeekedParticipant({ title })
    ),
  });
  return <CallingLobby {...props} />;
}

export function GroupCallWith0PeekedParticipantsBigGroup(): JSX.Element {
  const props = createProps({
    isGroupCall: true,
    groupMembers: times(100, () => getDefaultConversation()),
  });
  return <CallingLobby {...props} />;
}
