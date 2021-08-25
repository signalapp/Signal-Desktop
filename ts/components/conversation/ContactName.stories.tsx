// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { ContactName } from './ContactName';
import { ContactNameColors } from '../../types/Colors';

const i18n = setupI18n('en', enMessages);

storiesOf('Components/Conversation/ContactName', module)
  .add('Number, name and profile', () => {
    return (
      <ContactName
        title="Someone 🔥 Somewhere"
        name="Someone 🔥 Somewhere"
        phoneNumber="(202) 555-0011"
        profileName="🔥Flames🔥"
        i18n={i18n}
      />
    );
  })
  .add('Number and profile, no name', () => {
    return (
      <ContactName
        title="🔥Flames🔥"
        phoneNumber="(202) 555-0011"
        profileName="🔥Flames🔥"
        i18n={i18n}
      />
    );
  })
  .add('No name, no profile', () => {
    return (
      <ContactName
        title="(202) 555-0011"
        phoneNumber="(202) 555-0011"
        i18n={i18n}
      />
    );
  })
  .add('Colors', () => {
    return ContactNameColors.map(color => (
      <div key={color}>
        <ContactName
          title={`Hello ${color}`}
          contactNameColor={color}
          i18n={i18n}
          phoneNumber="(202) 555-0011"
        />
      </div>
    ));
  })
  .add('No data provided', () => {
    return <ContactName title="unknownContact" i18n={i18n} />;
  });
