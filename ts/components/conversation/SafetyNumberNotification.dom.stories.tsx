// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { ContactType, Props } from './SafetyNumberNotification.dom.tsx';
import { SafetyNumberNotification } from './SafetyNumberNotification.dom.tsx';

const { i18n } = window.SignalContext;

const createContact = (props: Partial<ContactType>): ContactType => ({
  id: '',
  title: props.title ?? '',
});

export default {
  title: 'Components/Conversation/SafetyNumberNotification',
  args: {
    i18n,
    contact: {} as ContactType,
    toggleSafetyNumberModal: action('toggleSafetyNumberModal'),
  },
} satisfies Meta<Props>;

export function Default(args: Props): JSX.Element {
  return (
    <SafetyNumberNotification
      {...args}
      contact={createContact({
        title: 'Mr. Fire',
      })}
    />
  );
}

export function LongName(args: Props): JSX.Element {
  return (
    <SafetyNumberNotification
      {...args}
      contact={createContact({
        title: '🐈‍⬛🍕🎂'.repeat(50),
      })}
    />
  );
}
