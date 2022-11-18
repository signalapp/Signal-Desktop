// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { ContactName } from './ContactName';
import { ContactNameColors } from '../../types/Colors';

export default {
  title: 'Components/Conversation/ContactName',
};

export function FirstNameAndTitleTitlePreferred(): JSX.Element {
  return <ContactName firstName="Ignored" title="Someone 🔥 Somewhere" />;
}

FirstNameAndTitleTitlePreferred.story = {
  name: 'First name and title; title preferred',
};

export function FirstNameAndTitleFirstNamePreferred(): JSX.Element {
  return (
    <ContactName
      firstName="Someone 🔥 Somewhere"
      title="Ignored"
      preferFirstName
    />
  );
}

FirstNameAndTitleFirstNamePreferred.story = {
  name: 'First name and title; first name preferred',
};

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
