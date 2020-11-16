// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { gifUrl } from '../storybook/Fixtures';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';
import { ContactListItem } from './ContactListItem';

const i18n = setupI18n('en', enMessages);
const onClick = action('onClick');

storiesOf('Components/ContactListItem', module)
  .add("It's me!", () => {
    return (
      <ContactListItem
        i18n={i18n}
        isMe
        title="Someone 🔥 Somewhere"
        name="Someone 🔥 Somewhere"
        phoneNumber="(202) 555-0011"
        isVerified
        profileName="🔥Flames🔥"
        avatarPath={gifUrl}
        onClick={onClick}
      />
    );
  })
  .add('With name and profile (note vertical spacing)', () => {
    return (
      <div>
        <ContactListItem
          i18n={i18n}
          title="Someone 🔥 Somewhere"
          name="Someone 🔥 Somewhere"
          phoneNumber="(202) 555-0011"
          profileName="🔥Flames🔥"
          avatarPath={gifUrl}
          onClick={onClick}
        />
        <ContactListItem
          i18n={i18n}
          title="Another ❄️ Yes"
          name="Another ❄️ Yes"
          phoneNumber="(202) 555-0011"
          profileName="❄️Ice❄️"
          avatarPath={gifUrl}
          onClick={onClick}
        />
      </div>
    );
  })
  .add('With name and profile, verified', () => {
    return (
      <ContactListItem
        i18n={i18n}
        title="Someone 🔥 Somewhere"
        name="Someone 🔥 Somewhere"
        phoneNumber="(202) 555-0011"
        profileName="🔥Flames🔥"
        isVerified
        avatarPath={gifUrl}
        onClick={onClick}
      />
    );
  })
  .add('With name and profile, admin', () => {
    return (
      <ContactListItem
        i18n={i18n}
        isAdmin
        title="Someone 🔥 Somewhere"
        name="Someone 🔥 Somewhere"
        phoneNumber="(202) 555-0011"
        profileName="🔥Flames🔥"
        isVerified
        avatarPath={gifUrl}
        onClick={onClick}
      />
    );
  })
  .add('With just number, admin', () => {
    return (
      <ContactListItem
        i18n={i18n}
        isAdmin
        title="(202) 555-0011"
        phoneNumber="(202) 555-0011"
        avatarPath={gifUrl}
        onClick={onClick}
      />
    );
  })
  .add('With name and profile, no avatar', () => {
    return (
      <ContactListItem
        i18n={i18n}
        title="Someone 🔥 Somewhere"
        name="Someone 🔥 Somewhere"
        color="teal"
        phoneNumber="(202) 555-0011"
        profileName="🔥Flames🔥"
        onClick={onClick}
      />
    );
  })
  .add('Profile, no name, no avatar', () => {
    return (
      <ContactListItem
        i18n={i18n}
        phoneNumber="(202) 555-0011"
        title="🔥Flames🔥"
        profileName="🔥Flames🔥"
        onClick={onClick}
      />
    );
  })
  .add('Verified, profile, no name, no avatar', () => {
    return (
      <ContactListItem
        i18n={i18n}
        phoneNumber="(202) 555-0011"
        title="🔥Flames🔥"
        profileName="🔥Flames🔥"
        isVerified
        onClick={onClick}
      />
    );
  })
  .add('No name, no profile, no avatar', () => {
    return (
      <ContactListItem
        i18n={i18n}
        phoneNumber="(202) 555-0011"
        title="(202) 555-0011"
        onClick={onClick}
      />
    );
  })
  .add('Verified, no name, no profile, no avatar', () => {
    return (
      <ContactListItem
        i18n={i18n}
        title="(202) 555-0011"
        phoneNumber="(202) 555-0011"
        isVerified
        onClick={onClick}
      />
    );
  })
  .add('No name, no profile, no number', () => {
    return (
      <ContactListItem i18n={i18n} title="Unknown contact" onClick={onClick} />
    );
  });
