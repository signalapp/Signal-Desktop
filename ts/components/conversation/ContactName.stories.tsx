import * as React from 'react';

import { storiesOf } from '@storybook/react';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { ContactName } from './ContactName';

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
  .add('No data provided', () => {
    return <ContactName title="unknownContact" i18n={i18n} />;
  });
