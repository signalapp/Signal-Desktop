// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, number } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './CallingHeader';
import { CallingHeader } from './CallingHeader';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  isGroupCall: boolean('isGroupCall', Boolean(overrideProps.isGroupCall)),
  message: overrideProps.message,
  participantCount: number(
    'participantCount',
    overrideProps.participantCount || 0
  ),
  showParticipantsList: boolean(
    'showParticipantsList',
    Boolean(overrideProps.showParticipantsList)
  ),
  title: overrideProps.title || 'With Someone',
  toggleParticipants: () => action('toggle-participants'),
  togglePip: () => action('toggle-pip'),
  toggleSettings: () => action('toggle-settings'),
});

const story = storiesOf('Components/CallingHeader', module);

story.add('Default', () => <CallingHeader {...createProps()} />);

story.add('Lobby style', () => (
  <CallingHeader
    {...createProps()}
    title={undefined}
    togglePip={undefined}
    onCancel={action('onClose')}
  />
));

story.add('With Participants', () => (
  <CallingHeader
    {...createProps({
      isGroupCall: true,
      participantCount: 10,
    })}
  />
));

story.add('With Participants (shown)', () => (
  <CallingHeader
    {...createProps({
      isGroupCall: true,
      participantCount: 10,
      showParticipantsList: true,
    })}
  />
));

story.add('Long Title', () => (
  <CallingHeader
    {...createProps({
      title:
        'What do I got to, what do I got to do to wake you up? To shake you up, to break the structure up?',
    })}
  />
));

story.add('Title with message', () => (
  <CallingHeader
    {...createProps({
      title: 'Hello world',
      message: 'Goodbye earth',
    })}
  />
));
