// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { Meta } from '@storybook/react';
import type { Props } from './BadgeDescription';
import { BadgeDescription } from './BadgeDescription';

export default {
  title: 'Components/BadgeDescription',
} satisfies Meta<Props>;

export function NormalName(): JSX.Element {
  return (
    <BadgeDescription
      template="{short_name} is here! Hello, {short_name}! {short_name}, I think you're great. This is not replaced: {not_replaced}"
      firstName="Alice"
      title="Should not be seen"
    />
  );
}

export function NameWithRTLOverrides(): JSX.Element {
  return (
    <BadgeDescription
      template="Hello, {short_name}! {short_name}, I think you're great."
      title={'Flip-\u202eflop'}
    />
  );
}
