// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { isBoolean } from 'lodash';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { number } from '@storybook/addon-knobs';

import { setup as setupI18n } from '../../../../js/modules/i18n';
import enMessages from '../../../../_locales/en/messages.json';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

import {
  ConversationDetailsMembershipList,
  Props,
  GroupV2Membership,
} from './ConversationDetailsMembershipList';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/ConversationDetailsMembershipList',
  module
);

const createMemberships = (
  numberOfMemberships = 10
): Array<GroupV2Membership> => {
  return Array.from(
    new Array(number('number of memberships', numberOfMemberships))
  ).map(
    (_, i): GroupV2Membership => ({
      isAdmin: i % 3 === 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata: {} as any,
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
  i18n,
  memberships: overrideProps.memberships || [],
  showContactModal: action('showContactModal'),
  startAddingNewMembers: action('startAddingNewMembers'),
});

story.add('Few', () => {
  const memberships = createMemberships(3);

  const props = createProps({ memberships });

  return <ConversationDetailsMembershipList {...props} />;
});

story.add('Limit', () => {
  const memberships = createMemberships(5);

  const props = createProps({ memberships });

  return <ConversationDetailsMembershipList {...props} />;
});

story.add('Limit +1', () => {
  const memberships = createMemberships(6);

  const props = createProps({ memberships });

  return <ConversationDetailsMembershipList {...props} />;
});

story.add('Limit +2', () => {
  const memberships = createMemberships(7);

  const props = createProps({ memberships });

  return <ConversationDetailsMembershipList {...props} />;
});

story.add('Many', () => {
  const memberships = createMemberships(100);

  const props = createProps({ memberships });

  return <ConversationDetailsMembershipList {...props} />;
});

story.add('None', () => {
  const props = createProps({ memberships: [] });

  return <ConversationDetailsMembershipList {...props} />;
});

story.add('Can add new members', () => {
  const memberships = createMemberships(10);

  const props = createProps({ canAddNewMembers: true, memberships });

  return <ConversationDetailsMembershipList {...props} />;
});
