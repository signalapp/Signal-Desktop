// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { ContactType, Props } from './UnsupportedMessage.dom.js';
import { UnsupportedMessage } from './UnsupportedMessage.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/UnsupportedMessage',
  argTypes: {
    canProcessNow: { control: { type: 'boolean' } },
  },
  args: {
    i18n,
    canProcessNow: false,
    contact: {} as ContactType,
  },
} satisfies Meta<Props>;

const createContact = (props: Partial<ContactType> = {}): ContactType => ({
  id: '',
  title: props.title ?? '',
  isMe: props.isMe ?? false,
});

export function FromSomeone(args: Props): JSX.Element {
  const contact = createContact({
    title: 'Alice',
    name: 'Alice',
  });

  return <UnsupportedMessage {...args} contact={contact} />;
}

export function AfterUpgrade(args: Props): JSX.Element {
  const contact = createContact({
    title: 'Alice',
    name: 'Alice',
  });

  return <UnsupportedMessage {...args} contact={contact} canProcessNow />;
}

export function FromYourself(args: Props): JSX.Element {
  const contact = createContact({
    title: 'Alice',
    name: 'Alice',
    isMe: true,
  });

  return <UnsupportedMessage {...args} contact={contact} />;
}

export function FromYourselfAfterUpgrade(args: Props): JSX.Element {
  const contact = createContact({
    title: 'Alice',
    name: 'Alice',
    isMe: true,
  });

  return <UnsupportedMessage {...args} contact={contact} canProcessNow />;
}
