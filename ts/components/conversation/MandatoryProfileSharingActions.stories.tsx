// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './MandatoryProfileSharingActions';
import { MandatoryProfileSharingActions } from './MandatoryProfileSharingActions';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/MandatoryProfileSharingActions',
  argTypes: {
    conversationType: {
      control: {
        type: 'select',
        options: ['direct', 'group'],
      },
    },
    firstName: { control: { type: 'text' } },
    title: { control: { type: 'text' } },
  },
  args: {
    conversationId: '123',
    i18n,
    conversationType: 'direct',
    firstName: 'Cayce',
    title: 'Cayce Bollard',
    acceptConversation: action('acceptConversation'),
    blockAndReportSpam: action('blockAndReportSpam'),
    blockConversation: action('blockConversation'),
    deleteConversation: action('deleteConversation'),
  },
} satisfies Meta<Props>;

export function Direct(args: Props): JSX.Element {
  return (
    <div style={{ width: '480px' }}>
      <MandatoryProfileSharingActions {...args} />
    </div>
  );
}

export function Group(args: Props): JSX.Element {
  return (
    <div style={{ width: '480px' }}>
      <MandatoryProfileSharingActions {...args} conversationType="group" />
    </div>
  );
}
