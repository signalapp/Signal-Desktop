// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { CallingParticipantsList, PropsType } from './CallingParticipantsList';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const participant = {
  title: 'Bardock',
};

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  onClose: action('on-close'),
  participants: overrideProps.participants || [participant],
});

const story = storiesOf('Components/CallingParticipantsList', module);

story.add('Default', () => {
  const props = createProps();
  return <CallingParticipantsList {...props} />;
});

story.add('Many Participants', () => {
  const props = createProps({
    participants: [
      {
        color: 'blue',
        profileName: 'Son Goku',
        title: 'Son Goku',
        audioMuted: true,
        videoMuted: true,
      },
      {
        color: 'deep_orange',
        profileName: 'Rage Trunks',
        title: 'Rage Trunks',
      },
      {
        color: 'indigo',
        profileName: 'Prince Vegeta',
        title: 'Prince Vegeta',
        videoMuted: true,
      },
      {
        color: 'pink',
        profileName: 'Goku Black',
        title: 'Goku Black',
      },
      {
        color: 'green',
        profileName: 'Supreme Kai Zamasu',
        title: 'Supreme Kai Zamasu',
        audioMuted: true,
        videoMuted: true,
      },
    ],
  });
  return <CallingParticipantsList {...props} />;
});
