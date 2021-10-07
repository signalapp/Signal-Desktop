// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';

import { ContactName } from './ContactName';
import { ContactNameColors } from '../../types/Colors';

storiesOf('Components/Conversation/ContactName', module)
  .add('First name and title; title preferred', () => (
    <ContactName firstName="Ignored" title="Someone 🔥 Somewhere" />
  ))
  .add('First name and title; first name preferred', () => (
    <ContactName
      firstName="Someone 🔥 Somewhere"
      title="Ignored"
      preferFirstName
    />
  ))
  .add('Colors', () => {
    return ContactNameColors.map(color => (
      <div key={color}>
        <ContactName title={`Hello ${color}`} contactNameColor={color} />
      </div>
    ));
  });
