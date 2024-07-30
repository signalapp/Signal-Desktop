// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { times } from 'lodash';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { ContactPills } from './ContactPills';
import type { PropsType as ContactPillPropsType } from './ContactPill';
import { ContactPill } from './ContactPill';
import { gifUrl } from '../storybook/Fixtures';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Contact Pills',
} satisfies Meta<ContactPillPropsType>;

type ContactType = Omit<ContactPillPropsType, 'i18n' | 'onClickRemove'>;

const contacts: Array<ContactType> = times(50, index =>
  getDefaultConversation({
    id: `contact-${index}`,
    name: `Contact ${index}`,
    phoneNumber: '(202) 555-0001',
    profileName: `C${index}`,
    title: `Contact ${index}`,
  })
);

const contactPillProps = (
  overrideProps?: ContactType
): ContactPillPropsType => ({
  ...(overrideProps ??
    getDefaultConversation({
      avatarUrl: gifUrl,
      firstName: 'John',
      id: 'abc123',
      isMe: false,
      name: 'John Bon Bon Jovi',
      phoneNumber: '(202) 555-0001',
      profileName: 'JohnB',
      title: 'John Bon Bon Jovi',
    })),
  i18n,
  onClickRemove: action('onClickRemove'),
});

export function EmptyList(): JSX.Element {
  return <ContactPills />;
}

export function OneContact(): JSX.Element {
  return (
    <ContactPills>
      <ContactPill {...contactPillProps()} />
    </ContactPills>
  );
}

export function ThreeContacts(): JSX.Element {
  return (
    <ContactPills>
      <ContactPill {...contactPillProps(contacts[0])} />
      <ContactPill {...contactPillProps(contacts[1])} />
      <ContactPill {...contactPillProps(contacts[2])} />
    </ContactPills>
  );
}

export function FourContactsOneWithALongName(): JSX.Element {
  return (
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
  );
}

export function FiftyContacts(): JSX.Element {
  return (
    <ContactPills>
      {contacts.map(contact => (
        <ContactPill key={contact.id} {...contactPillProps(contact)} />
      ))}
    </ContactPills>
  );
}
