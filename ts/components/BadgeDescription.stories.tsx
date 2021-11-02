// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';

import { BadgeDescription } from './BadgeDescription';

const story = storiesOf('Components/BadgeDescription', module);

story.add('Normal name', () => (
  <BadgeDescription
    template="{short_name} is here! Hello, {short_name}! {short_name}, I think you're great. This is not replaced: {not_replaced}"
    firstName="Alice"
    title="Should not be seen"
  />
));

story.add('Name with RTL overrides', () => (
  <BadgeDescription
    template="Hello, {short_name}! {short_name}, I think you're great."
    title={'Flip-\u202eflop'}
  />
));
