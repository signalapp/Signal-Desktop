// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { ContactType, Props } from './SafetyNumberNotification';
import { SafetyNumberNotification } from './SafetyNumberNotification';

const i18n = setupI18n('en', enMessages);

const createContact = (props: Partial<ContactType>): ContactType => ({
  id: '',
  title: props.title ?? '',
});

export default {
  title: 'Components/Conversation/SafetyNumberNotification',
  argTypes: {
    isGroup: { control: { type: 'boolean' } },
  },
  args: {
    i18n,
    contact: {} as ContactType,
    isGroup: false,
    toggleSafetyNumberModal: action('toggleSafetyNumberModal'),
  },
} satisfies Meta<Props>;

export function GroupConversation(args: Props): JSX.Element {
  return (
    <SafetyNumberNotification
      {...args}
      isGroup
      contact={createContact({
        title: 'Mr. Fire',
      })}
    />
  );
}

export function DirectConversation(args: Props): JSX.Element {
  return (
    <SafetyNumberNotification
      {...args}
      isGroup
      contact={createContact({
        title: 'Mr. Fire',
      })}
    />
  );
}

export function LongNameInGroup(args: Props): JSX.Element {
  return (
    <SafetyNumberNotification
      {...args}
      isGroup
      contact={createContact({
        title: '🐈‍⬛🍕🎂'.repeat(50),
      })}
    />
  );
}
