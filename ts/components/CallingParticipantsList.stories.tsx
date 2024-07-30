// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { sample } from 'lodash';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './CallingParticipantsList';
import { CallingParticipantsList } from './CallingParticipantsList';
import { AvatarColors } from '../types/Colors';
import type { GroupCallRemoteParticipantType } from '../types/Calling';
import { generateAci } from '../types/ServiceId';
import { getDefaultConversationWithServiceId } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

function createParticipant(
  participantProps: Partial<GroupCallRemoteParticipantType>
): GroupCallRemoteParticipantType {
  return {
    aci: generateAci(),
    demuxId: 2,
    hasRemoteAudio: Boolean(participantProps.hasRemoteAudio),
    hasRemoteVideo: Boolean(participantProps.hasRemoteVideo),
    isHandRaised: Boolean(participantProps.isHandRaised),
    mediaKeysReceived: Boolean(participantProps.mediaKeysReceived),
    presenting: Boolean(participantProps.presenting),
    sharingScreen: Boolean(participantProps.sharingScreen),
    videoAspectRatio: 1.3,
    ...getDefaultConversationWithServiceId({
      avatarUrl: participantProps.avatarUrl,
      color: sample(AvatarColors),
      isBlocked: Boolean(participantProps.isBlocked),
      name: participantProps.name,
      profileName: participantProps.title,
      title: String(participantProps.title),
    }),
  };
}

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  conversationId: 'fake-conversation-id',
  onClose: action('on-close'),
  ourServiceId: generateAci(),
  participants: overrideProps.participants || [],
  showContactModal: action('show-contact-modal'),
});

export default {
  title: 'Components/CallingParticipantsList',
} satisfies Meta<PropsType>;

export function NoOne(): JSX.Element {
  const props = createProps();
  return <CallingParticipantsList {...props} />;
}

export function SoloCall(): JSX.Element {
  const props = createProps({
    participants: [
      createParticipant({
        title: 'Bardock',
      }),
    ],
  });
  return <CallingParticipantsList {...props} />;
}

export function ManyParticipants(): JSX.Element {
  const props = createProps({
    participants: [
      createParticipant({
        title: 'Son Goku',
      }),
      createParticipant({
        hasRemoteAudio: true,
        hasRemoteVideo: true,
        presenting: true,
        name: 'Rage Trunks',
        title: 'Rage Trunks',
      }),
      createParticipant({
        hasRemoteAudio: true,
        title: 'Prince Vegeta',
      }),
      createParticipant({
        hasRemoteAudio: true,
        hasRemoteVideo: true,
        name: 'Goku Black',
        title: 'Goku Black',
      }),
      createParticipant({
        isHandRaised: true,
        title: 'Supreme Kai Zamasu',
      }),
      createParticipant({
        hasRemoteAudio: false,
        hasRemoteVideo: true,
        isHandRaised: true,
        title: 'Chi Chi',
      }),
      createParticipant({
        title: 'Someone With A Really Long Name',
      }),
    ],
  });
  return <CallingParticipantsList {...props} />;
}

export function Overflow(): JSX.Element {
  const props = createProps({
    participants: Array(50)
      .fill(null)
      .map(() => createParticipant({ title: 'Kirby' })),
  });
  return <CallingParticipantsList {...props} />;
}
