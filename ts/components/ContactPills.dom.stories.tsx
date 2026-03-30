// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import { ContactPills } from './ContactPills.dom.tsx';
import type { PropsType as ContactPillPropsType } from './ContactPill.dom.tsx';
import { ContactPill } from './ContactPill.dom.tsx';
import { gifUrl } from '../storybook/Fixtures.std.ts';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Contact Pills',
} satisfies Meta<ContactPillPropsType>;

type ContactType = Omit<ContactPillPropsType, 'i18n' | 'onClickRemove'>;

function createContact(index: number) {
  return getDefaultConversation({
    id: `contact-${index}`,
    name: `Contact ${index}`,
    phoneNumber: '(202) 555-0001',
    profileName: `C${index}`,
    title: `Contact ${index}`,
  });
}

const contactPillProps = (
  overrideProps?: ContactType
): ContactPillPropsType => ({
  ...(overrideProps ??
    getDefaultConversation({
      avatarUrl: gifUrl,
      firstName: 'John',
      hasAvatar: true,
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

export function EmptyList(): React.JSX.Element {
  return <ContactPills />;
}

export function OneContact(): React.JSX.Element {
  return (
    <ContactPills>
      <ContactPill {...contactPillProps()} />
    </ContactPills>
  );
}

export function ThreeContacts(): React.JSX.Element {
  return (
    <ContactPills>
      <ContactPill {...contactPillProps(createContact(0))} />
      <ContactPill {...contactPillProps(createContact(1))} />
      <ContactPill {...contactPillProps(createContact(2))} />
    </ContactPills>
  );
}

export function FourContactsOneWithALongName(): React.JSX.Element {
  return (
    <ContactPills>
      <ContactPill {...contactPillProps(createContact(0))} />
      <ContactPill
        {...contactPillProps({
          ...createContact(1),
          title:
            'Pablo Diego José Francisco de Paula Juan Nepomuceno María de los Remedios Cipriano de la Santísima Trinidad Ruiz y Picasso',
        })}
      />
      <ContactPill {...contactPillProps(createContact(2))} />
      <ContactPill {...contactPillProps(createContact(3))} />
    </ContactPills>
  );
}

export function FiftyContacts(): React.JSX.Element {
  return (
    <ContactPills>
      {Array.from({ length: 50 }, (_, index) => (
        <ContactPill key={index} {...contactPillProps(createContact(index))} />
      ))}
    </ContactPills>
  );
}
