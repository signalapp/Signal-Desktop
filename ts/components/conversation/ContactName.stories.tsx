// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './ContactName';
import { ContactName } from './ContactName';
import { ContactNameColors } from '../../types/Colors';

export default {
  title: 'Components/Conversation/ContactName',
} satisfies Meta<PropsType>;

export function FirstNameAndTitleTitlePreferred(): JSX.Element {
  return <ContactName firstName="Ignored" title="Someone 🔥 Somewhere" />;
}

export function FirstNameAndTitleFirstNamePreferred(): JSX.Element {
  return (
    <ContactName
      firstName="Someone 🔥 Somewhere"
      title="Ignored"
      preferFirstName
    />
  );
}

export function Colors(): JSX.Element {
  return (
    <>
      {ContactNameColors.map(color => (
        <div key={color}>
          <ContactName title={`Hello ${color}`} contactNameColor={color} />
        </div>
      ))}
    </>
  );
}
