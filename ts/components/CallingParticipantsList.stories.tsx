// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { CallingParticipantsList, PropsType } from './CallingParticipantsList';
import { Colors } from '../types/Colors';
import { GroupCallRemoteParticipantType } from '../types/Calling';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

function createParticipant(
  participantProps: Partial<GroupCallRemoteParticipantType>
): GroupCallRemoteParticipantType {
  const randomColor = Math.floor(Math.random() * Colors.length - 1);
  return {
    avatarPath: participantProps.avatarPath,
    color: Colors[randomColor],
    demuxId: 2,
    hasRemoteAudio: Boolean(participantProps.hasRemoteAudio),
    hasRemoteVideo: Boolean(participantProps.hasRemoteVideo),
    isSelf: Boolean(participantProps.isSelf),
    name: participantProps.name,
    profileName: participantProps.title,
    title: String(participantProps.title),
    videoAspectRatio: 1.3,
  };
}

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  onClose: action('on-close'),
  participants: overrideProps.participants || [],
});

const story = storiesOf('Components/CallingParticipantsList', module);

story.add('No one', () => {
  const props = createProps();
  return <CallingParticipantsList {...props} />;
});

story.add('Solo Call', () => {
  const props = createProps({
    participants: [
      createParticipant({
        title: 'Bardock',
      }),
    ],
  });
  return <CallingParticipantsList {...props} />;
});

story.add('Many Participants', () => {
  const props = createProps({
    participants: [
      createParticipant({
        isSelf: true,
        title: 'Son Goku',
      }),
      createParticipant({
        hasRemoteAudio: true,
        hasRemoteVideo: true,
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
});

story.add('Overflow', () => {
  const props = createProps({
    participants: Array(50)
      .fill(null)
      .map(() => createParticipant({ title: 'Kirby' })),
  });
  return <CallingParticipantsList {...props} />;
});
