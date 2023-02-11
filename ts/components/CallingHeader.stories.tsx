// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
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

export default {
  title: 'Components/CallingHeader',
};

export function Default(): JSX.Element {
  return <CallingHeader {...createProps()} />;
}

export function LobbyStyle(): JSX.Element {
  return (
    <CallingHeader
      {...createProps()}
      title={undefined}
      togglePip={undefined}
      onCancel={action('onClose')}
    />
  );
}

LobbyStyle.story = {
  name: 'Lobby style',
};

export function WithParticipants(): JSX.Element {
  return (
    <CallingHeader
      {...createProps({
        isGroupCall: true,
        participantCount: 10,
      })}
    />
  );
}

export function WithParticipantsShown(): JSX.Element {
  return (
    <CallingHeader
      {...createProps({
        isGroupCall: true,
        participantCount: 10,
        showParticipantsList: true,
      })}
    />
  );
}

WithParticipantsShown.story = {
  name: 'With Participants (shown)',
};

export function LongTitle(): JSX.Element {
  return (
    <CallingHeader
      {...createProps({
        title:
          'What do I got to, what do I got to do to wake you up? To shake you up, to break the structure up?',
      })}
    />
  );
}

export function TitleWithMessage(): JSX.Element {
  return (
    <CallingHeader
      {...createProps({
        title: 'Hello world',
        message: 'Goodbye earth',
      })}
    />
  );
}

TitleWithMessage.story = {
  name: 'Title with message',
};
