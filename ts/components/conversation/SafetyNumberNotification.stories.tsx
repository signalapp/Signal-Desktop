// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { ContactType, Props } from './SafetyNumberNotification.dom.js';
import { SafetyNumberNotification } from './SafetyNumberNotification.dom.js';

const { i18n } = window.SignalContext;

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
