// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import * as moment from 'moment';
import { storiesOf } from '@storybook/react';
import { boolean, number, select, text } from '@storybook/addon-knobs';

import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './TimerNotification';
import { TimerNotification } from './TimerNotification';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/TimerNotification', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  type: select(
    'type',
    {
      fromOther: 'fromOther',
      fromMe: 'fromMe',
      fromSync: 'fromSync',
    },
    overrideProps.type || 'fromOther'
  ),
  title: text('title', overrideProps.title || ''),
  ...(boolean('disabled', overrideProps.disabled || false)
    ? {
        disabled: true,
      }
    : {
        disabled: false,
        expireTimer: number(
          'expireTimer',
          ('expireTimer' in overrideProps ? overrideProps.expireTimer : 0) || 0
        ),
      }),
});

story.add('Set By Other', () => {
  const props = createProps({
    expireTimer: moment.duration(1, 'hour').asSeconds(),
    type: 'fromOther',
    title: 'Mr. Fire',
  });

  return (
    <>
      <TimerNotification {...props} />
      <div style={{ padding: '1em' }} />
      <TimerNotification {...props} disabled />
    </>
  );
});

story.add('Set By Other (with a long name)', () => {
  const longName = '🦴🧩📴'.repeat(50);

  const props = createProps({
    expireTimer: moment.duration(1, 'hour').asSeconds(),
    type: 'fromOther',
    title: longName,
  });

  return (
    <>
      <TimerNotification {...props} />
      <div style={{ padding: '1em' }} />
      <TimerNotification {...props} disabled />
    </>
  );
});

story.add('Set By You', () => {
  const props = createProps({
    expireTimer: moment.duration(1, 'hour').asSeconds(),
    type: 'fromMe',
    title: 'Mr. Fire',
  });

  return (
    <>
      <TimerNotification {...props} />
      <div style={{ padding: '1em' }} />
      <TimerNotification {...props} disabled />
    </>
  );
});

story.add('Set By Sync', () => {
  const props = createProps({
    expireTimer: moment.duration(1, 'hour').asSeconds(),
    type: 'fromSync',
    title: 'Mr. Fire',
  });

  return (
    <>
      <TimerNotification {...props} />
      <div style={{ padding: '1em' }} />
      <TimerNotification {...props} disabled />
    </>
  );
});
