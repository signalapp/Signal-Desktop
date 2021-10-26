// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import { date, number } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import type { Props } from './Countdown';
import { Countdown } from './Countdown';

const defaultDuration = 10 * 1000;
const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  duration: number('duration', overrideProps.duration || defaultDuration),
  expiresAt: date(
    'expiresAt',
    overrideProps.expiresAt
      ? new Date(overrideProps.expiresAt)
      : new Date(Date.now() + defaultDuration)
  ),
  onComplete: action('onComplete'),
});

const story = storiesOf('Components/Countdown', module);

story.add('Just Started', () => {
  const props = createProps();

  return <Countdown {...props} />;
});

story.add('In Progress', () => {
  const props = createProps({
    duration: 3 * defaultDuration,
    expiresAt: Date.now() + defaultDuration,
  });

  return <Countdown {...props} />;
});

story.add('Done', () => {
  const props = createProps({
    expiresAt: Date.now() - defaultDuration,
  });

  return <Countdown {...props} />;
});
