// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './MessageTimestamp';
import { MessageTimestamp } from './MessageTimestamp';

const i18n = setupI18n('en', enMessages);

const { now } = Date;
const seconds = (n: number) => n * 1000;
const minutes = (n: number) => 60 * seconds(n);
const hours = (n: number) => 60 * minutes(n);
const days = (n: number) => 24 * hours(n);

const get1201 = () => {
  const d = new Date();
  d.setHours(0, 1, 0, 0);
  return d.getTime();
};

const times = (): Array<[string, number]> => [
  ['500ms ago', now() - seconds(0.5)],
  ['30s ago', now() - seconds(30)],
  ['1m ago', now() - minutes(1)],
  ['30m ago', now() - minutes(30)],
  ['45m ago', now() - minutes(45)],
  ['1h ago', now() - hours(1)],
  ['12:01am today', get1201()],
  ['24h ago', now() - hours(24)],
  ['7d ago', now() - days(7)],
  ['366d ago', now() - days(366)],
];

export default {
  title: 'Components/Conversation/MessageTimestamp',
  argTypes: {
    timestamp: { control: { type: 'number' } },
    module: { control: { type: 'text' } },
    withImageNoCaption: { control: { type: 'boolean' } },
    withSticker: { control: { type: 'boolean' } },
    withTapToViewExpired: { control: { type: 'boolean' } },
    direction: {
      control: {
        type: 'select',
        options: ['', 'incoming', 'outgoing'],
      },
    },
  },
  args: {
    i18n,
    timestamp: Date.now(),
    module: '',
    withImageNoCaption: false,
    withSticker: false,
    withTapToViewExpired: false,
    direction: undefined,
  },
} satisfies Meta<Props>;

export function Normal(args: Props): JSX.Element {
  return (
    <table cellPadding={5}>
      <tbody>
        <tr>
          <th>Description</th>
          <th>Timestamp</th>
        </tr>
        {times().map(([description, timestamp]) => (
          <tr key={timestamp}>
            <td>{description}</td>
            <td>
              <MessageTimestamp
                key={timestamp}
                {...args}
                timestamp={timestamp}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Knobs(args: Props): JSX.Element {
  return <MessageTimestamp {...args} />;
}
