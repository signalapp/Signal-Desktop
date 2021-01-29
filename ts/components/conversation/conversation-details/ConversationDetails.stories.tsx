// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

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

const conversation: ConversationType = {
  id: '',
  lastUpdated: 0,
  markedUnread: false,
  memberships: Array.from(Array(32)).map(() => ({
    isAdmin: false,
    member: getDefaultConversation({}),
    metadata: {
      conversationId: '',
      joinedAtVersion: 0,
      role: 2,
    },
  })),
  pendingMemberships: Array.from(Array(16)).map(() => ({
    member: getDefaultConversation({}),
    metadata: {
      conversationId: '',
      role: 2,
      timestamp: Date.now(),
    },
  })),
  title: 'Some Conversation',
  type: 'group',
};

const createProps = (hasGroupLink = false): Props => ({
  canEditGroupInfo: false,
  conversation,
  hasGroupLink,
  i18n,
  isAdmin: false,
  loadRecentMediaItems: action('loadRecentMediaItems'),
  setDisappearingMessages: action('setDisappearingMessages'),
  showAllMedia: action('showAllMedia'),
  showContactModal: action('showContactModal'),
  showGroupLinkManagement: action('showGroupLinkManagement'),
  showGroupV2Permissions: action('showGroupV2Permissions'),
  showPendingInvites: action('showPendingInvites'),
  showLightboxForMedia: action('showLightboxForMedia'),
  onBlockAndDelete: action('onBlockAndDelete'),
  onDelete: action('onDelete'),
});

story.add('Basic', () => {
  const props = createProps();

  return <ConversationDetails {...props} />;
});

story.add('as Admin', () => {
  const props = createProps();

  return <ConversationDetails {...props} isAdmin />;
});

story.add('Group Editable', () => {
  const props = createProps();

  return <ConversationDetails {...props} canEditGroupInfo />;
});

story.add('Group Links On', () => {
  const props = createProps(true);

  return <ConversationDetails {...props} isAdmin />;
});
