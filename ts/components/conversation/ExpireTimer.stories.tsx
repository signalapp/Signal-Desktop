// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { boolean, number } from '@storybook/addon-knobs';

import type { Props } from './ExpireTimer';
import { ExpireTimer } from './ExpireTimer';

export default {
  title: 'Components/Conversation/ExpireTimer',
};

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

export const _30Seconds = (): JSX.Element => {
  const props = createProps();

  return <ExpireTimer {...props} />;
};

_30Seconds.story = {
  name: '30 seconds',
};

export const _2Minutes = (): JSX.Element => {
  const twoMinutes = 60 * 1000 * 2;
  const props = createProps({
    expirationTimestamp: Date.now() + twoMinutes,
    expirationLength: twoMinutes,
  });

  return <ExpireTimer {...props} />;
};

_2Minutes.story = {
  name: '2 minutes',
};

export const InProgress = (): JSX.Element => {
  const props = createProps({
    expirationTimestamp: Date.now() + 15 * 1000,
  });

  return <ExpireTimer {...props} />;
};

export const Expired = (): JSX.Element => {
  const props = createProps({
    expirationTimestamp: Date.now() - 30 * 1000,
  });

  return <ExpireTimer {...props} />;
};

export const Sticker = (): JSX.Element => {
  const props = createProps({
    withSticker: true,
  });

  return <ExpireTimer {...props} />;
};

export const TapToViewExpired = (): JSX.Element => {
  const props = createProps({
    withTapToViewExpired: true,
  });

  return <ExpireTimer {...props} />;
};

export const ImageNoCaption = (): JSX.Element => {
  const props = createProps({
    withImageNoCaption: true,
  });

  return (
    <div style={{ backgroundColor: 'darkgreen' }}>
      <ExpireTimer {...props} />
    </div>
  );
};

export const Incoming = (): JSX.Element => {
  const props = createProps({
    direction: 'incoming',
  });

  return (
    <div style={{ backgroundColor: 'darkgreen' }}>
      <ExpireTimer {...props} />
    </div>
  );
};

export const ExpirationTooFarOut = (): JSX.Element => {
  const props = createProps({
    expirationTimestamp: Date.now() + 150 * 1000,
  });

  return <ExpireTimer {...props} />;
};
