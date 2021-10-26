// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { date, number, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { Props } from './TimelineLoadingRow';
import { TimelineLoadingRow } from './TimelineLoadingRow';

const story = storiesOf('Components/Conversation/TimelineLoadingRow', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  state: select(
    'state',
    { idle: 'idle', countdown: 'countdown', loading: 'loading' },
    overrideProps.state || 'idle'
  ),
  duration: number('duration', overrideProps.duration || 0),
  expiresAt: date('expiresAt', new Date(overrideProps.expiresAt || Date.now())),
  onComplete: action('onComplete'),
});

story.add('Idle', () => {
  const props = createProps();

  return <TimelineLoadingRow {...props} />;
});

story.add('Countdown', () => {
  const props = createProps({
    state: 'countdown',
    duration: 40000,
    expiresAt: Date.now() + 20000,
  });

  return <TimelineLoadingRow {...props} />;
});

story.add('Loading', () => {
  const props = createProps({ state: 'loading' });

  return <TimelineLoadingRow {...props} />;
});
