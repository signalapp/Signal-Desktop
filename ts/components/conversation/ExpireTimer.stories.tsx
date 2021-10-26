// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { boolean, number } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import type { Props } from './ExpireTimer';
import { ExpireTimer } from './ExpireTimer';

const story = storiesOf('Components/Conversation/ExpireTimer', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  direction: overrideProps.direction || 'outgoing',
  expirationLength: number(
    'expirationLength',
    overrideProps.expirationLength || 30 * 1000
  ),
  expirationTimestamp: number(
    'expirationTimestamp',
    overrideProps.expirationTimestamp || Date.now() + 30 * 1000
  ),
  withImageNoCaption: boolean(
    'withImageNoCaption',
    overrideProps.withImageNoCaption || false
  ),
  withSticker: boolean('withSticker', overrideProps.withSticker || false),
  withTapToViewExpired: boolean(
    'withTapToViewExpired',
    overrideProps.withTapToViewExpired || false
  ),
});

story.add('30 seconds', () => {
  const props = createProps();

  return <ExpireTimer {...props} />;
});

story.add('2 minutes', () => {
  const twoMinutes = 60 * 1000 * 2;
  const props = createProps({
    expirationTimestamp: Date.now() + twoMinutes,
    expirationLength: twoMinutes,
  });

  return <ExpireTimer {...props} />;
});

story.add('In Progress', () => {
  const props = createProps({
    expirationTimestamp: Date.now() + 15 * 1000,
  });

  return <ExpireTimer {...props} />;
});

story.add('Expired', () => {
  const props = createProps({
    expirationTimestamp: Date.now() - 30 * 1000,
  });

  return <ExpireTimer {...props} />;
});

story.add('Sticker', () => {
  const props = createProps({
    withSticker: true,
  });

  return <ExpireTimer {...props} />;
});

story.add('Tap To View Expired', () => {
  const props = createProps({
    withTapToViewExpired: true,
  });

  return <ExpireTimer {...props} />;
});

story.add('Image No Caption', () => {
  const props = createProps({
    withImageNoCaption: true,
  });

  return (
    <div style={{ backgroundColor: 'darkgreen' }}>
      <ExpireTimer {...props} />
    </div>
  );
});

story.add('Incoming', () => {
  const props = createProps({
    direction: 'incoming',
  });

  return (
    <div style={{ backgroundColor: 'darkgreen' }}>
      <ExpireTimer {...props} />
    </div>
  );
});

story.add('Expiration Too Far Out', () => {
  const props = createProps({
    expirationTimestamp: Date.now() + 150 * 1000,
  });

  return <ExpireTimer {...props} />;
});
