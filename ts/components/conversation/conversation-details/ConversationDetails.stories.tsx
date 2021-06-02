// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { times } from 'lodash';

import { setup as setupI18n } from '../../../../js/modules/i18n';
import enMessages from '../../../../_locales/en/messages.json';
import { ConversationDetails, Props } from './ConversationDetails';
import { ConversationType } from '../../../state/ducks/conversations';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/ConversationDetails/ConversationDetails',
  module
);

const conversation: ConversationType = getDefaultConversation({
  id: '',
  lastUpdated: 0,
  title: 'Some Conversation',
  groupDescription: 'Hello World!',
  type: 'group',
  sharedGroupNames: [],
  conversationColor: 'ultramarine' as const,
});

const createProps = (hasGroupLink = false, expireTimer?: number): Props => ({
  addMembers: async () => {
    action('addMembers');
  },
  canEditGroupInfo: false,
  candidateContactsToAdd: times(10, () => getDefaultConversation()),
  conversation: expireTimer
    ? {
        ...conversation,
        expireTimer,
      }
    : conversation,
  hasGroupLink,
  i18n,
  isAdmin: false,
  loadRecentMediaItems: action('loadRecentMediaItems'),
  memberships: times(32, i => ({
    isAdmin: i === 1,
    member: getDefaultConversation({
      isMe: i === 2,
    }),
  })),
  pendingApprovalMemberships: times(8, () => ({
    member: getDefaultConversation(),
  })),
  pendingMemberships: times(5, () => ({
    metadata: {},
    member: getDefaultConversation(),
  })),
  setDisappearingMessages: action('setDisappearingMessages'),
  showAllMedia: action('showAllMedia'),
  showContactModal: action('showContactModal'),
  showGroupChatColorEditor: action('showGroupChatColorEditor'),
  showGroupLinkManagement: action('showGroupLinkManagement'),
  showGroupV2Permissions: action('showGroupV2Permissions'),
  showPendingInvites: action('showPendingInvites'),
  showLightboxForMedia: action('showLightboxForMedia'),
  updateGroupAttributes: async () => {
    action('updateGroupAttributes')();
  },
  onBlock: action('onBlock'),
  onLeave: action('onLeave'),
});

story.add('Basic', () => {
  const props = createProps();

  return <ConversationDetails {...props} />;
});

story.add('as Admin', () => {
  const props = createProps();

  return <ConversationDetails {...props} isAdmin />;
});

story.add('as last admin', () => {
  const props = createProps();

  return (
    <ConversationDetails
      {...props}
      isAdmin
      memberships={times(32, i => ({
        isAdmin: i === 2,
        member: getDefaultConversation({
          isMe: i === 2,
        }),
      }))}
    />
  );
});

story.add('as only admin', () => {
  const props = createProps();

  return (
    <ConversationDetails
      {...props}
      isAdmin
      memberships={[
        {
          isAdmin: true,
          member: getDefaultConversation({
            isMe: true,
          }),
        },
      ]}
    />
  );
});

story.add('Group Editable', () => {
  const props = createProps();

  return <ConversationDetails {...props} canEditGroupInfo />;
});

story.add('Group Editable with custom disappearing timeout', () => {
  const props = createProps(false, 3 * 24 * 60 * 60);

  return <ConversationDetails {...props} canEditGroupInfo />;
});

story.add('Group Links On', () => {
  const props = createProps(true);

  return <ConversationDetails {...props} isAdmin />;
});
