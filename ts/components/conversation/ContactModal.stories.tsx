// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { boolean } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { ContactModal, PropsType } from './ContactModal';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { ConversationType } from '../../state/ducks/conversations';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/ContactModal', module);

const defaultContact: ConversationType = {
  id: 'abcdef',
  lastUpdated: Date.now(),
  markedUnread: false,
  areWeAdmin: false,
  title: 'Pauline Oliveros',
  type: 'direct',
  phoneNumber: '(333) 444-5515',
};

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  areWeAdmin: boolean('areWeAdmin', overrideProps.areWeAdmin || false),
  contact: overrideProps.contact || defaultContact,
  i18n,
  isMember: boolean('isMember', overrideProps.isMember || true),
  onClose: action('onClose'),
  openConversation: action('openConversation'),
  removeMember: action('removeMember'),
  showSafetyNumber: action('showSafetyNumber'),
});

story.add('As non-admin', () => {
  const props = createProps({
    areWeAdmin: false,
  });

  return <ContactModal {...props} />;
});

story.add('As admin', () => {
  const props = createProps({
    areWeAdmin: true,
  });
  return <ContactModal {...props} />;
});

story.add('As admin, viewing non-member of group', () => {
  const props = createProps({
    isMember: false,
  });

  return <ContactModal {...props} />;
});

story.add('Without phone number', () => {
  const props = createProps({
    contact: {
      ...defaultContact,
      phoneNumber: undefined,
    },
  });

  return <ContactModal {...props} />;
});

story.add('Viewing self', () => {
  const props = createProps({
    contact: {
      ...defaultContact,
      isMe: true,
    },
  });

  return <ContactModal {...props} />;
});
