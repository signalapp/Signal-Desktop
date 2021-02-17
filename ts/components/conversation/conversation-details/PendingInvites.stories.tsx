// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setup as setupI18n } from '../../../../js/modules/i18n';
import enMessages from '../../../../_locales/en/messages.json';
import { PendingInvites, PropsType } from './PendingInvites';
import { ConversationType } from '../../../state/ducks/conversations';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/PendingInvites',
  module
);

const sortedGroupMembers = Array.from(Array(32)).map((_, i) =>
  i === 0
    ? getDefaultConversation({ id: 'def456' })
    : getDefaultConversation({})
);

const conversation: ConversationType = {
  areWeAdmin: true,
  id: '',
  lastUpdated: 0,
  markedUnread: false,
  memberships: sortedGroupMembers.map(member => ({
    isAdmin: false,
    member,
    metadata: {
      conversationId: 'abc123',
      joinedAtVersion: 1,
      role: 1,
    },
  })),
  pendingMemberships: Array.from(Array(4))
    .map(() => ({
      member: getDefaultConversation({}),
      metadata: {
        addedByUserId: 'abc123',
        conversationId: 'xyz789',
        role: 1,
        timestamp: Date.now(),
      },
    }))
    .concat(
      Array.from(Array(8)).map(() => ({
        member: getDefaultConversation({}),
        metadata: {
          addedByUserId: 'def456',
          conversationId: 'xyz789',
          role: 1,
          timestamp: Date.now(),
        },
      }))
    ),
  pendingApprovalMemberships: Array.from(Array(5)).map(() => ({
    member: getDefaultConversation({}),
    metadata: {
      conversationId: 'xyz789',
      timestamp: Date.now(),
    },
  })),
  sortedGroupMembers,
  title: 'Some Conversation',
  type: 'group',
};

const createProps = (): PropsType => ({
  approvePendingMembership: action('approvePendingMembership'),
  conversation,
  i18n,
  ourConversationId: 'abc123',
  revokePendingMemberships: action('revokePendingMemberships'),
});

story.add('Basic', () => {
  const props = createProps();

  return <PendingInvites {...props} />;
});
