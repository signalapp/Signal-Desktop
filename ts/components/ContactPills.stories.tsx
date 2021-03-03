// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { times } from 'lodash';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';
import { ContactPills } from './ContactPills';
import { ContactPill, PropsType as ContactPillPropsType } from './ContactPill';
import { gifUrl } from '../storybook/Fixtures';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Contact Pills', module);

type ContactType = Omit<ContactPillPropsType, 'i18n' | 'onClickRemove'>;

const contacts: Array<ContactType> = times(50, index => ({
  color: 'red',
  id: `contact-${index}`,
  isMe: false,
  name: `Contact ${index}`,
  phoneNumber: '(202) 555-0001',
  profileName: `C${index}`,
  title: `Contact ${index}`,
}));

const contactPillProps = (
  overrideProps?: ContactType
): ContactPillPropsType => ({
  ...(overrideProps || {
    avatarPath: gifUrl,
    color: 'red',
    firstName: 'John',
    id: 'abc123',
    isMe: false,
    name: 'John Bon Bon Jovi',
    phoneNumber: '(202) 555-0001',
    profileName: 'JohnB',
    title: 'John Bon Bon Jovi',
  }),
  i18n,
  onClickRemove: action('onClickRemove'),
});

story.add('Empty list', () => <ContactPills />);

story.add('One contact', () => (
  <ContactPills>
    <ContactPill {...contactPillProps()} />
  </ContactPills>
));

story.add('Three contacts', () => (
  <ContactPills>
    <ContactPill {...contactPillProps(contacts[0])} />
    <ContactPill {...contactPillProps(contacts[1])} />
    <ContactPill {...contactPillProps(contacts[2])} />
  </ContactPills>
));

story.add('Four contacts, one with a long name', () => (
  <ContactPills>
    <ContactPill {...contactPillProps(contacts[0])} />
    <ContactPill
      {...contactPillProps({
        ...contacts[1],
        title:
          'Pablo Diego José Francisco de Paula Juan Nepomuceno María de los Remedios Cipriano de la Santísima Trinidad Ruiz y Picasso',
      })}
    />
    <ContactPill {...contactPillProps(contacts[2])} />
    <ContactPill {...contactPillProps(contacts[3])} />
  </ContactPills>
));

story.add('Fifty contacts', () => (
  <ContactPills>
    {contacts.map(contact => (
      <ContactPill key={contact.id} {...contactPillProps(contact)} />
    ))}
  </ContactPills>
));
