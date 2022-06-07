// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { isBoolean } from 'lodash';

import { action } from '@storybook/addon-actions';
import { number } from '@storybook/addon-knobs';

import { setupI18n } from '../../../util/setupI18n';
import enMessages from '../../../../_locales/en/messages.json';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';
import { ThemeType } from '../../../types/Util';

import type {
  Props,
  GroupV2Membership,
} from './ConversationDetailsMembershipList';
import { ConversationDetailsMembershipList } from './ConversationDetailsMembershipList';

const i18n = setupI18n('en', enMessages);

export default {
  title:
    'Components/Conversation/ConversationDetails/ConversationDetailsMembershipList',
};

const createMemberships = (
  numberOfMemberships = 10
): Array<GroupV2Membership> => {
  return Array.from(
    new Array(number('number of memberships', numberOfMemberships))
  ).map(
    (_, i): GroupV2Membership => ({
      isAdmin: i % 3 === 0,
      member: getDefaultConversation({
        isMe: i === 2,
      }),
    })
  );
};

const createProps = (overrideProps: Partial<Props>): Props => ({
  canAddNewMembers: isBoolean(overrideProps.canAddNewMembers)
    ? overrideProps.canAddNewMembers
    : false,
  conversationId: '123',
  getPreferredBadge: () => undefined,
  i18n,
  memberships: overrideProps.memberships || [],
  showContactModal: action('showContactModal'),
  startAddingNewMembers: action('startAddingNewMembers'),
  theme: ThemeType.light,
});

export const Few = (): JSX.Element => {
  const memberships = createMemberships(3);

  const props = createProps({ memberships });

  return <ConversationDetailsMembershipList {...props} />;
};

export const Limit = (): JSX.Element => {
  const memberships = createMemberships(5);

  const props = createProps({ memberships });

  return <ConversationDetailsMembershipList {...props} />;
};

export const Limit1 = (): JSX.Element => {
  const memberships = createMemberships(6);

  const props = createProps({ memberships });

  return <ConversationDetailsMembershipList {...props} />;
};

Limit1.story = {
  name: 'Limit +1',
};

export const Limit2 = (): JSX.Element => {
  const memberships = createMemberships(7);

  const props = createProps({ memberships });

  return <ConversationDetailsMembershipList {...props} />;
};

Limit2.story = {
  name: 'Limit +2',
};

export const Many = (): JSX.Element => {
  const memberships = createMemberships(100);

  const props = createProps({ memberships });

  return <ConversationDetailsMembershipList {...props} />;
};

export const None = (): JSX.Element => {
  const props = createProps({ memberships: [] });

  return <ConversationDetailsMembershipList {...props} />;
};

export const CanAddNewMembers = (): JSX.Element => {
  const memberships = createMemberships(10);

  const props = createProps({ canAddNewMembers: true, memberships });

  return <ConversationDetailsMembershipList {...props} />;
};

CanAddNewMembers.story = {
  name: 'Can add new members',
};
