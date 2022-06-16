// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { boolean } from '@storybook/addon-knobs';

import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';
import type { PropsType } from './ContactModal';
import { ContactModal } from './ContactModal';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { ConversationType } from '../../state/ducks/conversations';
import { getFakeBadges } from '../../test-both/helpers/getFakeBadge';
import { ThemeType } from '../../types/Util';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/ContactModal',
};

const defaultContact: ConversationType = getDefaultConversation({
  id: 'abcdef',
  title: 'Pauline Oliveros',
  phoneNumber: '(333) 444-5515',
  about: '👍 Free to chat',
});
const defaultGroup: ConversationType = getDefaultConversation({
  id: 'abcdef',
  areWeAdmin: true,
  title: "It's a group",
  groupLink: 'something',
});

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  areWeASubscriber: false,
  areWeAdmin: boolean('areWeAdmin', overrideProps.areWeAdmin || false),
  badges: overrideProps.badges || [],
  contact: overrideProps.contact || defaultContact,
  conversation: overrideProps.conversation || defaultGroup,
  hideContactModal: action('hideContactModal'),
  i18n,
  isAdmin: boolean('isAdmin', overrideProps.isAdmin || false),
  isMember: boolean('isMember', overrideProps.isMember || true),
  removeMemberFromGroup: action('removeMemberFromGroup'),
  showConversation: action('showConversation'),
  theme: ThemeType.light,
  toggleSafetyNumberModal: action('toggleSafetyNumberModal'),
  toggleAdmin: action('toggleAdmin'),
  updateConversationModelSharedGroups: action(
    'updateConversationModelSharedGroups'
  ),
});

export const AsNonAdmin = (): JSX.Element => {
  const props = createProps({
    areWeAdmin: false,
  });

  return <ContactModal {...props} />;
};

AsNonAdmin.story = {
  name: 'As non-admin',
};

export const AsAdmin = (): JSX.Element => {
  const props = createProps({
    areWeAdmin: true,
  });
  return <ContactModal {...props} />;
};

AsAdmin.story = {
  name: 'As admin',
};

export const AsAdminWithNoGroupLink = (): JSX.Element => {
  const props = createProps({
    areWeAdmin: true,
    conversation: {
      ...defaultGroup,
      groupLink: undefined,
    },
  });
  return <ContactModal {...props} />;
};

AsAdminWithNoGroupLink.story = {
  name: 'As admin with no group link',
};

export const AsAdminViewingNonMemberOfGroup = (): JSX.Element => {
  const props = createProps({
    isMember: false,
  });

  return <ContactModal {...props} />;
};

AsAdminViewingNonMemberOfGroup.story = {
  name: 'As admin, viewing non-member of group',
};

export const WithoutPhoneNumber = (): JSX.Element => {
  const props = createProps({
    contact: {
      ...defaultContact,
      phoneNumber: undefined,
    },
  });

  return <ContactModal {...props} />;
};

WithoutPhoneNumber.story = {
  name: 'Without phone number',
};

export const ViewingSelf = (): JSX.Element => {
  const props = createProps({
    contact: {
      ...defaultContact,
      isMe: true,
    },
  });

  return <ContactModal {...props} />;
};

ViewingSelf.story = {
  name: 'Viewing self',
};

export const WithBadges = (): JSX.Element => {
  const props = createProps({
    badges: getFakeBadges(2),
  });

  return <ContactModal {...props} />;
};

WithBadges.story = {
  name: 'With badges',
};
