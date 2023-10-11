// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './CallingHeader';
import { CallingHeader } from './CallingHeader';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/CallingHeader',
  component: CallingHeader,
  argTypes: {
    isGroupCall: { control: { type: 'boolean' } },
    participantCount: { control: { type: 'number' } },
    title: { control: { type: 'text' } },
  },
  args: {
    i18n,
    isGroupCall: false,
    message: '',
    participantCount: 0,
    showParticipantsList: false,
    title: 'With Someone',
    toggleParticipants: action('toggle-participants'),
    togglePip: action('toggle-pip'),
    toggleSettings: action('toggle-settings'),
  },
} satisfies Meta<PropsType>;

export function Default(args: PropsType): JSX.Element {
  return <CallingHeader {...args} />;
}

export function LobbyStyle(args: PropsType): JSX.Element {
  return (
    <CallingHeader
      {...args}
      title={undefined}
      togglePip={undefined}
      onCancel={action('onClose')}
    />
  );
}

export function WithParticipants(args: PropsType): JSX.Element {
  return <CallingHeader {...args} isGroupCall participantCount={10} />;
}

export function WithParticipantsShown(args: PropsType): JSX.Element {
  return (
    <CallingHeader
      {...args}
      isGroupCall
      participantCount={10}
      showParticipantsList
    />
  );
}

export function LongTitle(args: PropsType): JSX.Element {
  return (
    <CallingHeader
      {...args}
      title="What do I got to, what do I got to do to wake you up? To shake you up, to break the structure up?"
    />
  );
}

export function TitleWithMessage(args: PropsType): JSX.Element {
  return (
    <CallingHeader {...args} title="Hello world" message="Goodbye earth" />
  );
}
