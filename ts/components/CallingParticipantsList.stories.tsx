// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { sample } from 'lodash';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './CallingParticipantsList';
import { CallingParticipantsList } from './CallingParticipantsList';
import { AvatarColors } from '../types/Colors';
import type { GroupCallRemoteParticipantType } from '../types/Calling';
import { getDefaultConversationWithUuid } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

function createParticipant(
  participantProps: Partial<GroupCallRemoteParticipantType>
): GroupCallRemoteParticipantType {
  return {
    demuxId: 2,
    hasRemoteAudio: Boolean(participantProps.hasRemoteAudio),
    hasRemoteVideo: Boolean(participantProps.hasRemoteVideo),
    presenting: Boolean(participantProps.presenting),
    sharingScreen: Boolean(participantProps.sharingScreen),
    videoAspectRatio: 1.3,
    ...getDefaultConversationWithUuid({
      avatarPath: participantProps.avatarPath,
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
  onClose: action('on-close'),
  ourUuid: 'cf085e6a-e70b-41ec-a310-c198248af13f',
  participants: overrideProps.participants || [],
});

export default {
  title: 'Components/CallingParticipantsList',
};

export const NoOne = (): JSX.Element => {
  const props = createProps();
  return <CallingParticipantsList {...props} />;
};

NoOne.story = {
  name: 'No one',
};

export const SoloCall = (): JSX.Element => {
  const props = createProps({
    participants: [
      createParticipant({
        title: 'Bardock',
      }),
    ],
  });
  return <CallingParticipantsList {...props} />;
};

export const ManyParticipants = (): JSX.Element => {
  const props = createProps({
    participants: [
      createParticipant({
        title: 'Son Goku',
      }),
      createParticipant({
        hasRemoteAudio: true,
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
        title: 'Supreme Kai Zamasu',
      }),
    ],
  });
  return <CallingParticipantsList {...props} />;
};

export const Overflow = (): JSX.Element => {
  const props = createProps({
    participants: Array(50)
      .fill(null)
      .map(() => createParticipant({ title: 'Kirby' })),
  });
  return <CallingParticipantsList {...props} />;
};
