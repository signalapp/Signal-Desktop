// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './CallingHeader';
import { CallingHeader } from './CallingHeader';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { CallViewMode } from '../types/Calling';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/CallingHeader',
  component: CallingHeader,
  argTypes: {
    isGroupCall: { control: { type: 'boolean' } },
    participantCount: { control: { type: 'number' } },
  },
  args: {
    i18n,
    isGroupCall: false,
    participantCount: 0,
    togglePip: action('toggle-pip'),
    callViewMode: CallViewMode.Paginated,
    changeCallView: action('change-call-view'),
  },
} satisfies Meta<PropsType>;

export function Default(args: PropsType): JSX.Element {
  return <CallingHeader {...args} />;
}

export function LobbyStyle(args: PropsType): JSX.Element {
  return (
    <CallingHeader
      {...args}
      togglePip={undefined}
      onCancel={action('onClose')}
    />
  );
}
