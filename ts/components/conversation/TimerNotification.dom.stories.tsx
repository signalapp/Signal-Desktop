// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import { DurationInSeconds } from '../../util/durations/index.std.js';
import type { Props } from './TimerNotification.dom.js';
import { TimerNotification } from './TimerNotification.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/TimerNotification',
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['fromOther', 'fromMe', 'fromSync'],
    },
    disabled: { control: { type: 'boolean' } },
    expireTimer: { control: { type: 'number' } },
  },
  args: {
    i18n,
    type: 'fromOther',
    title: '',
    disabled: false,
    expireTimer: DurationInSeconds.fromHours(0),
  },
} satisfies Meta<Props>;

export function SetByOther(args: Props): JSX.Element {
  const props: Props = {
    ...args,
    disabled: false,
    expireTimer: DurationInSeconds.fromHours(1),
    type: 'fromOther',
    title: 'Mr. Fire',
  };

  return (
    <>
      <TimerNotification {...props} />
      <div style={{ padding: '1em' }} />
      <TimerNotification {...props} disabled />
    </>
  );
}

export function SetByOtherWithALongName(args: Props): JSX.Element {
  const longName = '🦴🧩📴'.repeat(50);

  const props: Props = {
    ...args,
    disabled: false,
    expireTimer: DurationInSeconds.fromHours(1),
    type: 'fromOther',
    title: longName,
  };

  return (
    <>
      <TimerNotification {...props} />
      <div style={{ padding: '1em' }} />
      <TimerNotification {...props} disabled />
    </>
  );
}

export function SetByYou(args: Props): JSX.Element {
  const props: Props = {
    ...args,
    disabled: false,
    expireTimer: DurationInSeconds.fromHours(1),
    type: 'fromMe',
    title: 'Mr. Fire',
  };

  return (
    <>
      <TimerNotification {...props} />
      <div style={{ padding: '1em' }} />
      <TimerNotification {...props} disabled />
    </>
  );
}

export function SetBySync(args: Props): JSX.Element {
  const props: Props = {
    ...args,
    disabled: false,
    expireTimer: DurationInSeconds.fromHours(1),
    type: 'fromSync',
    title: 'Mr. Fire',
  };

  return (
    <>
      <TimerNotification {...props} />
      <div style={{ padding: '1em' }} />
      <TimerNotification {...props} disabled />
    </>
  );
}

export function SetByUnknownContact(args: Props): JSX.Element {
  const props: Props = {
    ...args,
    disabled: false,
    expireTimer: DurationInSeconds.fromHours(1),
    type: 'fromMember',
    title: 'Unknown contact',
  };

  return (
    <>
      <TimerNotification {...props} />
      <div style={{ padding: '1em' }} />
      <TimerNotification {...props} disabled />
    </>
  );
}
