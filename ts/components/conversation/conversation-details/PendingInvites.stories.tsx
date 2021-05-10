// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { times } from 'lodash';

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
  acceptedMessageRequest: true,
  areWeAdmin: true,
  id: '',
  lastUpdated: 0,
  markedUnread: false,
  isMe: false,
  sortedGroupMembers,
  title: 'Some Conversation',
  type: 'group',
  sharedGroupNames: [],
};

const createProps = (): PropsType => ({
  approvePendingMembership: action('approvePendingMembership'),
  conversation,
  i18n,
  ourConversationId: 'abc123',
  pendingApprovalMemberships: times(5, () => ({
    member: getDefaultConversation(),
  })),
  pendingMemberships: [
    ...times(4, () => ({
      member: getDefaultConversation(),
      metadata: {
        addedByUserId: 'abc123',
      },
    })),
    ...times(8, () => ({
      member: getDefaultConversation(),
      metadata: {
        addedByUserId: 'def456',
      },
    })),
  ],
  revokePendingMemberships: action('revokePendingMemberships'),
});

story.add('Basic', () => {
  const props = createProps();

  return <PendingInvites {...props} />;
});
