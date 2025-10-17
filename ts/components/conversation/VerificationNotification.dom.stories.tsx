// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './VerificationNotification.dom.js';
import { VerificationNotification } from './VerificationNotification.dom.js';

const { i18n } = window.SignalContext;

const contact = { title: 'Mr. Fire' };

export default {
  title: 'Components/Conversation/VerificationNotification',
  argTypes: {
    type: {
      control: {
        type: 'select',
        options: ['markVerified', 'markNotVerified'],
      },
    },
    isLocal: { control: { type: 'boolean' } },
  },
  args: {
    i18n,
    type: 'markVerified',
    isLocal: true,
    contact,
  },
} satisfies Meta<Props>;

export function MarkAsVerified(args: Props): JSX.Element {
  return <VerificationNotification {...args} type="markVerified" />;
}

export function MarkAsNotVerified(args: Props): JSX.Element {
  return <VerificationNotification {...args} type="markNotVerified" />;
}

export function MarkAsVerifiedRemotely(args: Props): JSX.Element {
  return (
    <VerificationNotification {...args} type="markVerified" isLocal={false} />
  );
}

export function MarkAsNotVerifiedRemotely(args: Props): JSX.Element {
  return (
    <VerificationNotification
      {...args}
      type="markNotVerified"
      isLocal={false}
    />
  );
}

export function LongName(args: Props): JSX.Element {
  const longName = '🎆🍬🏈'.repeat(50);
  return (
    <VerificationNotification
      {...args}
      type="markVerified"
      contact={{ title: longName }}
    />
  );
}
