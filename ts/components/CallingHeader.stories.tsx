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
  conversationTitle: overrideProps.conversationTitle || 'With Someone',
  i18n,
  isGroupCall: boolean('isGroupCall', Boolean(overrideProps.isGroupCall)),
  remoteParticipants: number(
    'remoteParticipants',
    overrideProps.remoteParticipants || 0
  ),
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

story.add('Long Title', () => (
  <CallingHeader
    {...createProps({
      conversationTitle:
        'What do I got to, what do I got to do to wake you up? To shake you up, to break the structure up?',
    })}
  />
));
