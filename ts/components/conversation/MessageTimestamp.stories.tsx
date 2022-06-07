// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { boolean, date, select, text } from '@storybook/addon-knobs';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './MessageTimestamp';
import { MessageTimestamp } from './MessageTimestamp';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/MessageTimestamp',
};

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

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  timestamp: overrideProps.timestamp || Date.now(),
  module: text('module', ''),
  withImageNoCaption: boolean('withImageNoCaption', false),
  withSticker: boolean('withSticker', false),
  withTapToViewExpired: boolean('withTapToViewExpired', false),
  direction:
    select(
      'direction',
      { none: '', incoming: 'incoming', outgoing: 'outgoing' },
      ''
    ) || undefined,
});

const createTable = (overrideProps: Partial<Props> = {}) => (
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
              {...createProps({ ...overrideProps, timestamp })}
            />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const Normal = (): JSX.Element => {
  return createTable();
};

export const Knobs = (): JSX.Element => {
  const props = createProps({
    timestamp: date('timestamp', new Date()),
  });

  return <MessageTimestamp {...props} />;
};
