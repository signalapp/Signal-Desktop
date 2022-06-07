// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { BadgeDescription } from './BadgeDescription';

export default {
  title: 'Components/BadgeDescription',
};

export const NormalName = (): JSX.Element => (
  <BadgeDescription
    template="{short_name} is here! Hello, {short_name}! {short_name}, I think you're great. This is not replaced: {not_replaced}"
    firstName="Alice"
    title="Should not be seen"
  />
);

NormalName.story = {
  name: 'Normal name',
};

export const NameWithRtlOverrides = (): JSX.Element => (
  <BadgeDescription
    template="Hello, {short_name}! {short_name}, I think you're great."
    title={'Flip-\u202eflop'}
  />
);

NameWithRtlOverrides.story = {
  name: 'Name with RTL overrides',
};
