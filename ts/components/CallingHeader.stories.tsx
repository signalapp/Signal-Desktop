// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, number } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { CallingHeader, PropsType } from './CallingHeader';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  canPip: boolean('canPip', Boolean(overrideProps.canPip)),
  i18n,
  isGroupCall: boolean('isGroupCall', Boolean(overrideProps.isGroupCall)),
  message: overrideProps.message,
  remoteParticipants: number(
    'remoteParticipants',
    overrideProps.remoteParticipants || 0
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

story.add('Has Pip', () => (
  <CallingHeader {...createProps({ canPip: true })} />
));

story.add('With Participants', () => (
  <CallingHeader
    {...createProps({
      canPip: true,
      isGroupCall: true,
      remoteParticipants: 10,
    })}
  />
));

story.add('With Participants (shown)', () => (
  <CallingHeader
    {...createProps({
      canPip: true,
      isGroupCall: true,
      remoteParticipants: 10,
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
