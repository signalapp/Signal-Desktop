// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './CallingParticipantsList.dom.js';
import { CallingParticipantsList } from './CallingParticipantsList.dom.js';
import { generateAci } from '../types/ServiceId.std.js';
import { createCallParticipant } from '../test-helpers/createCallParticipant.std.js';

const { i18n } = window.SignalContext;

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
      createCallParticipant({
        title: 'Bardock',
      }),
    ],
  });
  return <CallingParticipantsList {...props} />;
}

export function ManyParticipants(): JSX.Element {
  const props = createProps({
    participants: [
      createCallParticipant({
        title: 'Son Goku',
      }),
      createCallParticipant({
        hasRemoteAudio: true,
        hasRemoteVideo: true,
        presenting: true,
        name: 'Rage Trunks',
        title: 'Rage Trunks',
      }),
      createCallParticipant({
        hasRemoteAudio: true,
        title: 'Prince Vegeta',
      }),
      createCallParticipant({
        hasRemoteAudio: true,
        hasRemoteVideo: true,
        name: 'Goku Black',
        title: 'Goku Black',
      }),
      createCallParticipant({
        isHandRaised: true,
        title: 'Supreme Kai Zamasu',
      }),
      createCallParticipant({
        hasRemoteAudio: false,
        hasRemoteVideo: true,
        isHandRaised: true,
        title: 'Chi Chi',
      }),
      createCallParticipant({
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
      .map(() => createCallParticipant({ title: 'Kirby' })),
  });
  return <CallingParticipantsList {...props} />;
}
